import { StreamState, StreamType, StreamError, createStreamState } from '@/types'

interface StreamingCoreConfig {
  serverUrl: string
  debug?: boolean
}

export class StreamingCore {
  private config: StreamingCoreConfig
  private state: StreamState
  private listeners: {
    onStateChange?: (state: StreamState) => void
    onError?: (error: StreamError) => void
  } = {}

  private currentStream: MediaStream | null = null
  private isInitialized: boolean = false

  constructor(config: StreamingCoreConfig) {
    this.config = config
    this.state = createStreamState()
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🚀 Initializing streaming core...')
      
      // Check browser support
      const isSupported = this.checkBrowserSupport()
      if (!isSupported) {
        throw new Error('Browser does not support required features')
      }

      this.isInitialized = true
      console.log('✅ Streaming core initialized successfully')
      return true

    } catch (error) {
      console.error('❌ Failed to initialize streaming core:', error)
      this.emitError({
        code: 'INITIALIZATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown initialization error',
        timestamp: new Date().toISOString()
      })
      return false
    }
  }

  private checkBrowserSupport(): boolean {
    // Fixed: Check if functions exist before calling them
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      window.MediaRecorder
    )
  }

  async startStream(type: StreamType): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Streaming core not initialized')
    }

    try {
      console.log('🎥 Starting stream:', type)
      
      this.updateState({
        isConnecting: true,
        streamType: type,
        error: undefined
      })

      // Get media stream based on type
      const stream = await this.getMediaStream(type)
      this.currentStream = stream

      this.updateState({
        isLive: true,
        isConnecting: false,
        webcamEnabled: type === 'webcam' || type === 'both',
        screenEnabled: type === 'screen' || type === 'both'
      })

      console.log('✅ Stream started successfully')

    } catch (error) {
      console.error('❌ Failed to start stream:', error)
      
      this.updateState({
        isConnecting: false,
        isLive: false,
        error: error instanceof Error ? error.message : 'Stream start failed'
      })

      throw error
    }
  }

  async stopStream(): Promise<void> {
    try {
      console.log('🛑 Stopping stream...')

      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => {
          track.stop()
        })
        this.currentStream = null
      }

      this.updateState({
        isLive: false,
        isConnecting: false,
        webcamEnabled: false,
        screenEnabled: false,
        viewerCount: 0,
        error: undefined
      })

      console.log('✅ Stream stopped successfully')

    } catch (error) {
      console.error('❌ Failed to stop stream:', error)
      throw error
    }
  }

  private async getMediaStream(type: StreamType): Promise<MediaStream> {
    switch (type) {
      case 'webcam':
        return await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true
        })
      
      case 'screen':
        return await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: true
        })
      
      case 'both':
        // For both, we'll start with webcam (could be enhanced to combine streams)
        return await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true
        })
      
      default:
        throw new Error(`Unsupported stream type: ${type}`)
    }
  }

  async toggleWebcam(): Promise<void> {
    if (!this.state.isLive) {
      await this.startStream('webcam')
    } else {
      await this.stopStream()
    }
  }

  async toggleScreen(): Promise<void> {
    if (!this.state.isLive) {
      await this.startStream('screen')
    } else {
      await this.stopStream()
    }
  }

  async connect(): Promise<boolean> {
    try {
      console.log('🔌 Connecting to streaming server...')
      // Basic connection logic - simplified for now
      return true
    } catch (error) {
      console.error('❌ Connection failed:', error)
      return false
    }
  }

  disconnect(): void {
    console.log('🔌 Disconnecting from streaming server...')
    this.stopStream()
  }

  isConnected(): boolean {
    return this.isInitialized
  }

  getCurrentStream(): MediaStream | undefined {
    return this.currentStream || undefined
  }

  getStreamStats(): any {
    return {
      isLive: this.state.isLive,
      streamType: this.state.streamType,
      viewerCount: this.state.viewerCount,
      uptime: this.state.isLive ? Date.now() - new Date(this.state.lastUpdated).getTime() : 0
    }
  }

  private updateState(updates: Partial<StreamState>): void {
    this.state = {
      ...this.state,
      ...updates,
      lastUpdated: new Date().toISOString()
    }
    
    this.listeners.onStateChange?.(this.state)
  }

  private emitError(error: StreamError): void {
    this.listeners.onError?.(error)
  }

  onStateChange(callback: (state: StreamState) => void): void {
    this.listeners.onStateChange = callback
  }

  onError(callback: (error: StreamError) => void): void {
    this.listeners.onError = callback
  }

  destroy(): void {
    console.log('🧹 Destroying streaming core...')
    this.stopStream()
    this.listeners = {}
    this.isInitialized = false
  }
}