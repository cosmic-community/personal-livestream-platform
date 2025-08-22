import { socketManager } from '@/lib/socket'
import {
  getUserMediaStream,
  createPeerConnection,
  createOffer,
  createAnswer,
  handleIceCandidate,
  stopMediaStream,
  combineStreams,
  monitorConnectionQuality
} from '@/lib/webrtc'
import { StreamState, StreamType, StreamError, BroadcasterState, StreamStats, createStreamState } from '@/types'

interface StreamManagerConfig {
  debug?: boolean
  videoConstraints?: MediaStreamConstraints['video']
  audioConstraints?: MediaStreamConstraints['audio']
  onStateChange?: (state: BroadcasterState) => void
  onError?: (error: StreamError) => void
  onViewerCountChange?: (count: number) => void
}

export class StreamManager {
  private config: StreamManagerConfig
  private state: BroadcasterState

  private localStreams: Map<StreamType, MediaStream> = new Map()
  private combinedStream: MediaStream | null = null
  private qualityMonitors: Map<string, () => void> = new Map()

  // Event handlers
  private onStateChangeCb?: (state: BroadcasterState) => void
  private onErrorCb?: (error: StreamError) => void

  constructor(config: StreamManagerConfig = {}) {
    this.config = {
      debug: config.debug || false,
      videoConstraints: config.videoConstraints || {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 }
      },
      audioConstraints: config.audioConstraints || {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      onStateChange: config.onStateChange,
      onError: config.onError,
      onViewerCountChange: config.onViewerCountChange
    }

    // Fixed: Initialize state as BroadcasterState with all required properties
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

    this.onStateChangeCb = config.onStateChange
    this.onErrorCb = config.onError

    this.setupSocketListeners()
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[StreamManager] ${message}`, data || '')
    }
  }

  private emitStateChange(): void {
    this.onStateChangeCb?.(this.state)
    this.config.onStateChange?.(this.state)
  }

  private emitError(error: StreamError): void {
    this.state.errors.push(error)
    this.onErrorCb?.(error)
    this.config.onError?.(error)
  }

  private setupSocketListeners(): void {
    socketManager.onViewerJoined(async (data: { socketId: string }) => {
      this.log('Viewer joined:', data.socketId)
      await this.handleViewerConnection(data.socketId)
    })

    socketManager.onViewerLeft((data: { socketId: string }) => {
      this.log('Viewer left:', data.socketId)
      this.handleViewerDisconnection(data.socketId)
    })

    socketManager.onAnswer(async (data: { answer: RTCSessionDescriptionInit; socketId: string }) => {
      this.log('Received answer from viewer:', data.socketId)
      await this.handleViewerAnswer(data.socketId, data.answer)
    })

    socketManager.onIceCandidate(async (data: { candidate: RTCIceCandidateInit; socketId: string }) => {
      const peerConnection = this.state.peerConnections.get(data.socketId)
      if (peerConnection) {
        await handleIceCandidate(peerConnection, data.candidate)
      }
    })

    socketManager.onViewerCount((count: number) => {
      this.state.viewerCount = count
      this.config.onViewerCountChange?.(count)
      this.emitStateChange()
    })
  }

  async startStream(type: StreamType): Promise<void> {
    try {
      this.log(`Starting ${type} stream...`)
      this.state.isConnecting = true
      this.state.streamType = type
      this.emitStateChange()

      // Get media stream based on type
      let mediaStream: MediaStream | undefined

      switch (type) {
        case 'webcam':
          mediaStream = await this.getWebcamStream()
          if (mediaStream) {
            this.localStreams.set('webcam', mediaStream)
            this.state.webcamEnabled = true
            this.state.screenEnabled = false
          }
          break

        case 'screen':
          mediaStream = await this.getScreenStream()
          if (mediaStream) {
            this.localStreams.set('screen', mediaStream)
            this.state.webcamEnabled = false
            this.state.screenEnabled = true
          }
          break

        case 'both':
          const webcamStream = await this.getWebcamStream()
          const screenStream = await this.getScreenStream()
          
          if (webcamStream && screenStream) {
            this.localStreams.set('webcam', webcamStream)
            this.localStreams.set('screen', screenStream)
            mediaStream = combineStreams([webcamStream, screenStream])
            this.state.webcamEnabled = true
            this.state.screenEnabled = true
          } else {
            throw new Error('Failed to get both webcam and screen streams')
          }
          break

        case 'combined':
          // Fixed: Handle 'combined' case same as 'both'
          const combinedWebcamStream = await this.getWebcamStream()
          const combinedScreenStream = await this.getScreenStream()
          
          if (combinedWebcamStream && combinedScreenStream) {
            this.localStreams.set('webcam', combinedWebcamStream)
            this.localStreams.set('screen', combinedScreenStream)
            mediaStream = combineStreams([combinedWebcamStream, combinedScreenStream])
            this.state.webcamEnabled = true
            this.state.screenEnabled = true
          } else {
            throw new Error('Failed to get combined streams')
          }
          break

        default:
          throw new Error(`Unsupported stream type: ${type}`)
      }

      if (!mediaStream) {
        throw new Error(`Failed to get ${type} stream`)
      }

      this.combinedStream = mediaStream

      // Start broadcasting
      await socketManager.startBroadcast(type)

      this.state.isLive = true
      this.state.isStreaming = true
      this.state.isConnecting = false
      this.emitStateChange()

      this.log('Stream started successfully')

    } catch (error) {
      this.log('Failed to start stream:', error)
      this.state.isConnecting = false
      this.emitStateChange()

      this.emitError({
        code: 'STREAM_START_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start stream',
        timestamp: new Date().toISOString()
      })

      throw error
    }
  }

  async stopStream(): Promise<void> {
    try {
      this.log('Stopping stream...')

      // Stop socket broadcast
      socketManager.stopBroadcast()

      // Close all peer connections
      this.state.peerConnections.forEach((pc, socketId) => {
        pc.close()
        const monitor = this.qualityMonitors.get(socketId)
        if (monitor) {
          monitor()
          this.qualityMonitors.delete(socketId)
        }
      })
      this.state.peerConnections.clear()

      // Stop all local streams
      this.localStreams.forEach((stream) => {
        stopMediaStream(stream)
      })
      this.localStreams.clear()

      if (this.combinedStream) {
        stopMediaStream(this.combinedStream)
        this.combinedStream = null
      }

      // Reset state - Fixed: Use proper BroadcasterState structure
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
      this.log('Stream stopped successfully')

    } catch (error) {
      this.log('Error stopping stream:', error)
      throw error
    }
  }

  private async getWebcamStream(): Promise<MediaStream | undefined> {
    try {
      const stream = await getUserMediaStream({
        video: this.config.videoConstraints,
        audio: this.config.audioConstraints
      })
      this.log('Webcam stream acquired')
      return stream
    } catch (error) {
      this.log('Failed to get webcam stream:', error)
      return undefined
    }
  }

  private async getScreenStream(): Promise<MediaStream | undefined> {
    try {
      // Fixed: Use proper MediaStreamConstraints for getDisplayMedia
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        } as MediaTrackConstraints,
        audio: true
      }
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints)
      this.log('Screen stream acquired')
      return stream
    } catch (error) {
      this.log('Failed to get screen stream:', error)
      return undefined
    }
  }

  private async handleViewerConnection(socketId: string): Promise<void> {
    try {
      if (!this.combinedStream) {
        throw new Error('No active stream to share')
      }

      this.log('Setting up peer connection for viewer:', socketId)

      const peerConnection = createPeerConnection(
        (candidate: RTCIceCandidate) => {
          socketManager.sendIceCandidate(candidate, socketId)
        },
        (state: RTCPeerConnectionState) => {
          this.log(`Peer connection state changed for ${socketId}:`, state)
          if (state === 'disconnected' || state === 'failed') {
            this.handleViewerDisconnection(socketId)
          }
        },
        (event: RTCTrackEvent) => {
          this.log('Unexpected track event in broadcaster mode')
        }
      )

      // Add stream tracks to peer connection
      if (this.combinedStream) {
        this.combinedStream.getTracks().forEach(track => {
          if (this.combinedStream) {  // Additional null check for type safety
            peerConnection.addTrack(track, this.combinedStream)
          }
        })
      }

      // Create and send offer
      const offer = await createOffer(peerConnection)
      socketManager.sendOffer(offer, socketId)

      // Store peer connection
      this.state.peerConnections.set(socketId, peerConnection)

      // Start quality monitoring
      const stopMonitoring = monitorConnectionQuality(peerConnection, (stats: RTCStatsReport) => {
        this.handleConnectionStats(socketId, stats)
      })
      this.qualityMonitors.set(socketId, stopMonitoring)

    } catch (error) {
      this.log('Error handling viewer connection:', error)
      this.emitError({
        code: 'VIEWER_CONNECTION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to connect viewer',
        timestamp: new Date().toISOString(),
        details: { socketId }
      })
    }
  }

  private handleViewerDisconnection(socketId: string): void {
    this.log('Handling viewer disconnection:', socketId)

    const peerConnection = this.state.peerConnections.get(socketId)
    if (peerConnection) {
      peerConnection.close()
      this.state.peerConnections.delete(socketId)
    }

    const monitor = this.qualityMonitors.get(socketId)
    if (monitor) {
      monitor()
      this.qualityMonitors.delete(socketId)
    }
  }

  private async handleViewerAnswer(socketId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      const peerConnection = this.state.peerConnections.get(socketId)
      if (!peerConnection) {
        throw new Error('No peer connection found for viewer')
      }

      await peerConnection.setRemoteDescription(answer)
      this.log('Answer set for viewer:', socketId)

    } catch (error) {
      this.log('Error handling viewer answer:', error)
      this.handleViewerDisconnection(socketId)
    }
  }

  // Fixed: Add proper type annotations for parameters
  private handleConnectionStats(socketId: string, stats: RTCStatsReport): void {
    // Process connection quality statistics
    let totalBytesReceived = 0
    let totalBytesSent = 0
    let packetLoss = 0

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp') {
        totalBytesReceived += report.bytesReceived || 0
      } else if (report.type === 'outbound-rtp') {
        totalBytesSent += report.bytesSent || 0
        packetLoss = report.fractionLost || 0
      }
    })

    // Update quality metrics (could emit to UI)
    this.log(`Connection stats for ${socketId}:`, {
      bytesReceived: totalBytesReceived,
      bytesSent: totalBytesSent,
      packetLoss
    })
  }

  // Add missing methods for useStream hook
  async toggleWebcam(): Promise<void> {
    try {
      if (this.state.webcamEnabled) {
        // Turn off webcam
        const webcamStream = this.localStreams.get('webcam')
        if (webcamStream) {
          stopMediaStream(webcamStream)
          this.localStreams.delete('webcam')
        }
        this.state.webcamEnabled = false
      } else {
        // Turn on webcam
        const webcamStream = await this.getWebcamStream()
        if (webcamStream) {
          this.localStreams.set('webcam', webcamStream)
          this.state.webcamEnabled = true
        }
      }
      this.emitStateChange()
    } catch (error) {
      this.emitError({
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
        const screenStream = this.localStreams.get('screen')
        if (screenStream) {
          stopMediaStream(screenStream)
          this.localStreams.delete('screen')
        }
        this.state.screenEnabled = false
      } else {
        // Turn on screen share
        const screenStream = await this.getScreenStream()
        if (screenStream) {
          this.localStreams.set('screen', screenStream)
          this.state.screenEnabled = true
        }
      }
      this.emitStateChange()
    } catch (error) {
      this.emitError({
        code: 'SCREEN_TOGGLE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to toggle screen share',
        timestamp: new Date().toISOString()
      })
      throw error
    }
  }

  // Public methods
  get stream(): MediaStream | null {
    return this.combinedStream
  }

  get statistics(): StreamStats {
    return this.state.stats
  }

  getCurrentStream(): MediaStream | null {
    return this.combinedStream
  }

  getState(): BroadcasterState {
    return { ...this.state }
  }

  isStreaming(): boolean {
    return this.state.isLive
  }

  getViewerCount(): number {
    return this.state.viewerCount
  }

  getConnectedViewers(): string[] {
    return Array.from(this.state.peerConnections.keys())
  }

  // Event handlers
  onStateChange(callback: (state: BroadcasterState) => void): void {
    this.onStateChangeCb = callback
    // Emit current state immediately
    callback(this.state)
  }

  onError(callback: (error: StreamError) => void): void {
    this.onErrorCb = callback
  }

  destroy(): void {
    this.log('Destroying stream manager...')
    this.stopStream().catch(console.error)
    socketManager.disconnect()
  }
}

export default StreamManager