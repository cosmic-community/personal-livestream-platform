import { socketManager } from '@/lib/socket'
import {
  getUserMediaStream,
  getDisplayMediaStream,
  createPeerConnection,
  createOffer,
  createAnswer,
  handleIceCandidate,
  stopMediaStream,
  combineStreams,
  checkWebRTCSupport
} from '@/lib/webrtc'
import { StreamState, StreamType, StreamError, createStreamState } from '@/types'

interface StreamingCoreConfig {
  serverUrl?: string
  debug?: boolean
  videoConstraints?: MediaStreamConstraints['video']
  audioConstraints?: MediaStreamConstraints['audio']
}

export class StreamingCore {
  private config: StreamingCoreConfig
  private state: StreamState
  private mediaStreams: Map<string, MediaStream> = new Map()
  private peerConnections: Map<string, RTCPeerConnection> = new Map()
  private isInitialized = false

  // Event callbacks
  private onStateChangeCb?: (state: StreamState) => void
  private onErrorCb?: (error: StreamError) => void

  constructor(config: StreamingCoreConfig = {}) {
    this.config = {
      serverUrl: config.serverUrl || 'ws://localhost:3001',
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
      }
    }

    this.state = createStreamState({
      isLive: false,
      isConnecting: false,
      streamType: 'webcam',
      webcamEnabled: false,
      screenEnabled: false,
      viewerCount: 0
    })
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[StreamingCore] ${message}`, data || '')
    }
  }

  private emitStateChange(): void {
    if (this.onStateChangeCb) {
      this.onStateChangeCb(this.state)
    }
  }

  private emitError(error: StreamError): void {
    if (this.onErrorCb) {
      this.onErrorCb(error)
    }
  }

  async initialize(): Promise<boolean> {
    try {
      if (!checkWebRTCSupport()) {
        throw new Error('WebRTC is not supported in this browser')
      }

      this.isInitialized = true
      this.log('StreamingCore initialized successfully')
      return true

    } catch (error) {
      this.log('Failed to initialize StreamingCore:', error)
      this.emitError({
        code: 'INIT_FAILED',
        message: error instanceof Error ? error.message : 'Initialization failed',
        timestamp: new Date().toISOString()
      })
      return false
    }
  }

  async connect(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        throw new Error('StreamingCore not initialized')
      }

      const socket = socketManager.connect()
      this.log('Connected to signaling server:', socket.id)
      return true

    } catch (error) {
      this.log('Failed to connect:', error)
      this.emitError({
        code: 'CONNECTION_FAILED',
        message: error instanceof Error ? error.message : 'Connection failed',
        timestamp: new Date().toISOString()
      })
      return false
    }
  }

  async startStream(type: StreamType): Promise<void> {
    try {
      this.log(`Starting ${type} stream...`)
      this.state.isConnecting = true
      this.state.streamType = type
      this.emitStateChange()

      let mediaStream: MediaStream | undefined

      switch (type) {
        case 'webcam':
          mediaStream = await this.getWebcamStream()
          if (mediaStream) {
            this.mediaStreams.set('webcam', mediaStream)
            this.state.webcamEnabled = true
            this.state.screenEnabled = false
          }
          break

        case 'screen':
          mediaStream = await this.getScreenStream()
          if (mediaStream) {
            this.mediaStreams.set('screen', mediaStream)
            this.state.webcamEnabled = false
            this.state.screenEnabled = true
          }
          break

        case 'both':
          const webcamStream = await this.getWebcamStream()
          const screenStream = await this.getScreenStream()
          
          if (webcamStream && screenStream) {
            this.mediaStreams.set('webcam', webcamStream)
            this.mediaStreams.set('screen', screenStream)
            mediaStream = combineStreams([webcamStream, screenStream])
            this.state.webcamEnabled = true
            this.state.screenEnabled = true
          } else {
            throw new Error('Failed to get both webcam and screen streams')
          }
          break

        default:
          throw new Error(`Unsupported stream type: ${type}`)
      }

      if (!mediaStream) {
        throw new Error(`Failed to get ${type} stream`)
      }

      this.mediaStreams.set('combined', mediaStream)

      await socketManager.startBroadcast(type)

      this.state.isLive = true
      this.state.isConnecting = false
      if ('mediaStream' in this.state) {
        this.state.mediaStream = mediaStream
      }
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

      socketManager.stopBroadcast()

      this.peerConnections.forEach((pc) => {
        pc.close()
      })
      this.peerConnections.clear()

      this.mediaStreams.forEach((stream) => {
        stopMediaStream(stream)
      })
      this.mediaStreams.clear()

      this.state = createStreamState({
        isLive: false,
        isConnecting: false,
        streamType: 'webcam',
        webcamEnabled: false,
        screenEnabled: false,
        viewerCount: 0
      })

      if ('mediaStream' in this.state) {
        this.state.mediaStream = null
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
      const stream = await getDisplayMediaStream({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      })
      this.log('Screen stream acquired')
      return stream
    } catch (error) {
      this.log('Failed to get screen stream:', error)
      return undefined
    }
  }

  async toggleWebcam(): Promise<void> {
    try {
      if (this.state.webcamEnabled) {
        const webcamStream = this.mediaStreams.get('webcam')
        if (webcamStream) {
          stopMediaStream(webcamStream)
          this.mediaStreams.delete('webcam')
        }
        this.state.webcamEnabled = false
      } else {
        const webcamStream = await this.getWebcamStream()
        if (webcamStream) {
          this.mediaStreams.set('webcam', webcamStream)
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
        const screenStream = this.mediaStreams.get('screen')
        if (screenStream) {
          stopMediaStream(screenStream)
          this.mediaStreams.delete('screen')
        }
        this.state.screenEnabled = false
      } else {
        const screenStream = await this.getScreenStream()
        if (screenStream) {
          this.mediaStreams.set('screen', screenStream)
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

  getCurrentStream(): MediaStream | null {
    return this.mediaStreams.get('combined') || null
  }

  getStreamStats(): any {
    return {
      streamsCount: this.mediaStreams.size,
      connectionsCount: this.peerConnections.size,
      isLive: this.state.isLive
    }
  }

  isConnected(): boolean {
    return socketManager.isConnected()
  }

  onStateChange(callback: (state: StreamState) => void): void {
    this.onStateChangeCb = callback
  }

  onError(callback: (error: StreamError) => void): void {
    this.onErrorCb = callback
  }

  disconnect(): void {
    socketManager.disconnect()
  }

  destroy(): void {
    this.log('Destroying streaming core...')
    this.stopStream().catch(console.error)
    this.disconnect()
  }
}

export default StreamingCore