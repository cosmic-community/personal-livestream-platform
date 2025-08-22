import { StreamState, StreamType, StreamError, BroadcasterState, createStreamState } from '@/types'
import { socketManager } from '@/lib/socket'
import { 
  getUserMediaStream, 
  getDisplayMediaStream, 
  createPeerConnection, 
  createOffer, 
  handleIceCandidate,
  stopMediaStream,
  combineStreams 
} from '@/lib/webrtc'

interface StreamManagerConfig {
  onStateChange?: (state: BroadcasterState) => void
  onError?: (error: StreamError) => void
  onViewerCountChange?: (count: number) => void
  debug?: boolean
}

export class StreamManager {
  private config: StreamManagerConfig
  private state: BroadcasterState
  private mediaStreams: Map<string, MediaStream> = new Map()
  private peerConnections: Map<string, RTCPeerConnection> = new Map()

  constructor(config: StreamManagerConfig = {}) {
    this.config = config
    
    // Initialize state with proper BroadcasterState structure
    this.state = {
      ...createStreamState(),
      isStreaming: false,
      streamQuality: 'medium',
      currentSession: null,
      mediaStream: null,
      peerConnections: new Map<string, RTCPeerConnection>(),
      stats: {
        totalBytesReceived: 0,
        totalBytesSent: 0,
        packetLoss: 0,
        connectionQuality: 'good',
        averageBitrate: 0,
        frameRate: 0,
        resolution: '720p',
        latency: 0
      },
      errors: []
    }
    
    this.setupSocketListeners()
  }

  // Public methods to register callbacks - FIXED: Add these missing methods
  onStateChange(callback: (state: BroadcasterState) => void): void {
    this.config.onStateChange = callback
  }

  onError(callback: (error: StreamError) => void): void {
    this.config.onError = callback
  }

  onViewerCountChange(callback: (count: number) => void): void {
    this.config.onViewerCountChange = callback
  }

  private setupSocketListeners() {
    // Viewer events
    socketManager.onViewerJoined((data) => {
      this.log('Viewer joined:', data.socketId)
      // Handle new viewer
    })

    socketManager.onViewerLeft((data) => {
      this.log('Viewer left:', data.socketId)
      // Handle viewer leaving
    })

    socketManager.onError((error) => {
      this.handleError({
        code: 'SOCKET_ERROR',
        message: error,
        timestamp: new Date().toISOString()
      })
    })
  }

  async startStream(streamType: StreamType): Promise<void> {
    try {
      this.state.isConnecting = true
      this.state.streamType = streamType
      this.emitStateChange()

      let mediaStream: MediaStream | undefined

      switch (streamType) {
        case 'webcam':
          mediaStream = await getUserMediaStream({
            video: { width: 1280, height: 720 },
            audio: true
          })
          this.state.webcamEnabled = true
          this.state.screenEnabled = false
          break

        case 'screen':
          mediaStream = await getDisplayMediaStream({
            video: { width: 1920, height: 1080 },
            audio: true
          })
          this.state.webcamEnabled = false
          this.state.screenEnabled = true
          break

        case 'both':
          const webcamStream = await getUserMediaStream({
            video: { width: 1280, height: 720 },
            audio: true
          })
          const screenStream = await getDisplayMediaStream({
            video: { width: 1920, height: 1080 },
            audio: false
          })
          
          mediaStream = combineStreams([webcamStream, screenStream])
          this.state.webcamEnabled = true
          this.state.screenEnabled = true
          break
      }

      if (!mediaStream) {
        throw new Error(`Failed to get ${streamType} stream`)
      }

      this.state.mediaStream = mediaStream
      this.state.isLive = true
      this.state.isConnecting = false
      this.state.isStreaming = true
      this.emitStateChange()

      // Start broadcasting through socket
      await socketManager.startBroadcast(streamType)

    } catch (error) {
      this.state.isConnecting = false
      this.handleError({
        code: 'STREAM_START_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start stream',
        timestamp: new Date().toISOString()
      })
      throw error
    }
  }

  async stopStream(): Promise<void> {
    try {
      // Stop broadcasting
      socketManager.stopBroadcast()

      // Close peer connections
      this.peerConnections.forEach((pc) => {
        pc.close()
      })
      this.peerConnections.clear()

      // Stop media streams
      this.mediaStreams.forEach((stream) => {
        stopMediaStream(stream)
      })
      this.mediaStreams.clear()

      if (this.state.mediaStream) {
        stopMediaStream(this.state.mediaStream)
      }

      // Reset state
      this.state = {
        ...createStreamState(),
        isStreaming: false,
        streamQuality: 'medium',
        currentSession: null,
        mediaStream: null,
        peerConnections: new Map<string, RTCPeerConnection>(),
        stats: {
          totalBytesReceived: 0,
          totalBytesSent: 0,
          packetLoss: 0,
          connectionQuality: 'good',
          averageBitrate: 0,
          frameRate: 0,
          resolution: '720p',
          latency: 0
        },
        errors: []
      }

      this.emitStateChange()

    } catch (error) {
      this.handleError({
        code: 'STREAM_STOP_FAILED',
        message: error instanceof Error ? error.message : 'Failed to stop stream',
        timestamp: new Date().toISOString()
      })
      throw error
    }
  }

  async toggleWebcam(): Promise<void> {
    try {
      if (this.state.webcamEnabled) {
        // Turn off webcam
        const webcamStream = this.mediaStreams.get('webcam')
        if (webcamStream) {
          stopMediaStream(webcamStream)
          this.mediaStreams.delete('webcam')
        }
        this.state.webcamEnabled = false
      } else {
        // Turn on webcam
        const webcamStream = await getUserMediaStream({
          video: { width: 1280, height: 720 },
          audio: true
        })
        this.mediaStreams.set('webcam', webcamStream)
        this.state.webcamEnabled = true
      }
      this.emitStateChange()
    } catch (error) {
      this.handleError({
        code: 'WEBCAM_TOGGLE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to toggle webcam',
        timestamp: new Date().toISOString()
      })
      throw error
    }
  }

  async toggleScreen(): Promise<void> {
    try {
      if (this.state.screenEnabled) {
        // Turn off screen share
        const screenStream = this.mediaStreams.get('screen')
        if (screenStream) {
          stopMediaStream(screenStream)
          this.mediaStreams.delete('screen')
        }
        this.state.screenEnabled = false
      } else {
        // Turn on screen share
        const screenStream = await getDisplayMediaStream({
          video: { width: 1920, height: 1080 },
          audio: true
        })
        this.mediaStreams.set('screen', screenStream)
        this.state.screenEnabled = true
      }
      this.emitStateChange()
    } catch (error) {
      this.handleError({
        code: 'SCREEN_TOGGLE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to toggle screen share',
        timestamp: new Date().toISOString()
      })
      throw error
    }
  }

  // Getters
  get stream(): MediaStream | null {
    return this.state.mediaStream
  }

  get statistics() {
    return this.state.stats
  }

  // Private methods
  private emitStateChange() {
    this.state.lastUpdated = new Date().toISOString()
    this.config.onStateChange?.(this.state)
  }

  private handleError(error: StreamError) {
    this.state.errors.push(error)
    this.config.onError?.(error)
    this.log('Error:', error.message)
  }

  private log(message: string, ...args: any[]) {
    if (this.config.debug) {
      console.log(`[StreamManager] ${message}`, ...args)
    }
  }

  destroy() {
    this.stopStream().catch(console.error)
  }
}