import { socketManager } from '@/lib/socket'
import { MediaHandler } from '@/lib/media-handler'
import { checkWebRTCSupport } from '@/lib/webrtc'
import { StreamState, StreamType, StreamError } from '@/types'

interface StreamingConfig {
  serverUrl?: string
  debug?: boolean
}

export class StreamingCore {
  private config: StreamingConfig
  private mediaHandler: MediaHandler
  private isInitialized = false
  private currentStream?: MediaStream
  private streamState: StreamState = {
    isLive: false,
    isConnecting: false,
    streamType: 'webcam',
    webcamEnabled: false,
    screenEnabled: false,
    viewerCount: 0
  }
  
  // Event handlers
  private onStateChangeCb?: (state: StreamState) => void
  private onErrorCb?: (error: StreamError) => void

  constructor(config: StreamingConfig = {}) {
    this.config = {
      serverUrl: config.serverUrl || 'ws://localhost:3001',
      debug: config.debug || false
    }
    this.mediaHandler = new MediaHandler()
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[StreamingCore] ${message}`, data || '')
    }
  }

  private emitStateChange(): void {
    this.onStateChangeCb?.(this.streamState)
  }

  private emitError(error: StreamError): void {
    this.onErrorCb?.(error)
  }

  async initialize(): Promise<boolean> {
    try {
      this.log('Initializing streaming core...')
      
      // Check WebRTC support
      const isSupported = checkWebRTCSupport()
      if (!isSupported) {
        throw new Error('WebRTC is not supported in this browser')
      }

      // Setup socket event listeners
      this.setupSocketListeners()
      
      this.isInitialized = true
      this.log('Streaming core initialized successfully')
      
      return true
    } catch (error) {
      this.log('Failed to initialize streaming core', error)
      this.emitError({
        code: 'INITIALIZATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to initialize',
        timestamp: new Date().toISOString()
      })
      return false
    }
  }

  private setupSocketListeners(): void {
    // Stream events
    socketManager.onStreamStarted((data) => {
      this.log('Stream started', data)
      this.streamState.isLive = true
      this.streamState.isConnecting = false
      this.streamState.sessionId = data.sessionId
      this.emitStateChange()
    })

    socketManager.onStreamEnded((data) => {
      this.log('Stream ended', data)
      this.streamState.isLive = false
      this.streamState.isConnecting = false
      this.streamState.sessionId = undefined
      this.emitStateChange()
    })

    socketManager.onViewerCount((count) => {
      this.log('Viewer count updated', count)
      this.streamState.viewerCount = count
      this.emitStateChange()
    })

    socketManager.onStreamError((error) => {
      this.log('Stream error', error)
      this.streamState.isConnecting = false
      this.emitError({
        code: error.code || 'STREAM_ERROR',
        message: error.message || 'Stream error occurred',
        timestamp: error.timestamp || new Date().toISOString(),
        details: error.details
      })
    })
  }

  async connect(): Promise<boolean> {
    try {
      this.log('Connecting to streaming server...')
      this.streamState.isConnecting = true
      this.emitStateChange()

      const socket = socketManager.connect()
      
      // Wait for connection
      let attempts = 0
      const maxAttempts = 30 // 15 seconds
      
      while (!socketManager.isConnected() && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500))
        attempts++
      }

      const connected = socketManager.isConnected()
      this.streamState.isConnecting = false
      this.emitStateChange()

      this.log(`Connection ${connected ? 'successful' : 'failed'}`)
      return connected

    } catch (error) {
      this.log('Connection failed', error)
      this.streamState.isConnecting = false
      this.emitStateChange()
      
      this.emitError({
        code: 'CONNECTION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to connect',
        timestamp: new Date().toISOString()
      })
      return false
    }
  }

  disconnect(): void {
    this.log('Disconnecting...')
    socketManager.disconnect()
    this.cleanup()
  }

  async startStream(type: StreamType): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Streaming core not initialized')
    }

    if (!socketManager.isConnected()) {
      throw new Error('Not connected to streaming server')
    }

    try {
      this.log(`Starting ${type} stream...`)
      this.streamState.isConnecting = true
      this.streamState.streamType = type
      this.emitStateChange()

      // Get media stream based on type
      let stream: MediaStream
      
      switch (type) {
        case 'webcam':
          stream = await this.mediaHandler.getWebcamStream()
          this.streamState.webcamEnabled = true
          this.streamState.screenEnabled = false
          break
          
        case 'screen':
          stream = await this.mediaHandler.getScreenStream()
          this.streamState.webcamEnabled = false
          this.streamState.screenEnabled = true
          break
          
        case 'both':
        case 'combined':
          stream = await this.mediaHandler.getCombinedStream(true, true)
          this.streamState.webcamEnabled = true
          this.streamState.screenEnabled = true
          break
          
        default:
          throw new Error(`Unsupported stream type: ${type}`)
      }

      this.currentStream = stream

      // Start broadcast
      await socketManager.startBroadcast(type)
      
      this.log('Stream started successfully')

    } catch (error) {
      this.log('Failed to start stream', error)
      this.streamState.isConnecting = false
      this.emitStateChange()
      
      // Cleanup on failure
      this.cleanup()
      
      throw error
    }
  }

  async stopStream(): Promise<void> {
    try {
      this.log('Stopping stream...')
      
      // Stop socket broadcast
      socketManager.stopBroadcast()
      
      // Cleanup media
      this.cleanup()
      
      this.log('Stream stopped successfully')
      
    } catch (error) {
      this.log('Error stopping stream', error)
      throw error
    }
  }

  async toggleWebcam(): Promise<void> {
    if (!this.streamState.isLive) {
      throw new Error('Cannot toggle webcam when not streaming')
    }

    try {
      this.log('Toggling webcam...')
      
      if (this.streamState.webcamEnabled) {
        // Disable webcam
        const webcamStream = this.mediaHandler.getActiveWebcamStream()
        if (webcamStream) {
          this.mediaHandler.stopStream(webcamStream)
        }
        this.streamState.webcamEnabled = false
      } else {
        // Enable webcam
        const webcamStream = await this.mediaHandler.getWebcamStream()
        // Add tracks to current stream if both exist
        if (this.currentStream && webcamStream) {
          webcamStream.getTracks().forEach(track => {
            if (this.currentStream) {
              this.currentStream.addTrack(track)
            }
          })
        }
        this.streamState.webcamEnabled = true
      }
      
      this.emitStateChange()
      this.log('Webcam toggled successfully')
      
    } catch (error) {
      this.log('Failed to toggle webcam', error)
      throw error
    }
  }

  async toggleScreen(): Promise<void> {
    if (!this.streamState.isLive) {
      throw new Error('Cannot toggle screen share when not streaming')
    }

    try {
      this.log('Toggling screen share...')
      
      if (this.streamState.screenEnabled) {
        // Disable screen share
        const screenStream = this.mediaHandler.getActiveScreenStream()
        if (screenStream) {
          this.mediaHandler.stopStream(screenStream)
        }
        this.streamState.screenEnabled = false
      } else {
        // Enable screen share
        const screenStream = await this.mediaHandler.getScreenStream()
        // Add tracks to current stream if both exist
        if (this.currentStream && screenStream) {
          screenStream.getTracks().forEach(track => {
            if (this.currentStream) {
              this.currentStream.addTrack(track)
            }
          })
        }
        this.streamState.screenEnabled = true
      }
      
      this.emitStateChange()
      this.log('Screen share toggled successfully')
      
    } catch (error) {
      this.log('Failed to toggle screen share', error)
      throw error
    }
  }

  private cleanup(): void {
    if (this.currentStream) {
      this.mediaHandler.stopStream(this.currentStream)
      this.currentStream = undefined
    }
    
    this.mediaHandler.stopAllStreams()
    
    this.streamState.isLive = false
    this.streamState.isConnecting = false
    this.streamState.webcamEnabled = false
    this.streamState.screenEnabled = false
    this.streamState.viewerCount = 0
    this.streamState.sessionId = undefined
    
    this.emitStateChange()
  }

  // Public getters and methods
  getCurrentStream(): MediaStream | undefined {
    return this.currentStream
  }

  getStreamState(): StreamState {
    return { ...this.streamState }
  }

  getStreamStats(): any {
    return {
      isLive: this.streamState.isLive,
      viewerCount: this.streamState.viewerCount,
      streamType: this.streamState.streamType,
      hasWebcam: this.streamState.webcamEnabled,
      hasScreen: this.streamState.screenEnabled,
      connectionState: socketManager.getConnectionState(),
      fallbackMode: socketManager.isFallbackMode()
    }
  }

  isConnected(): boolean {
    return socketManager.isConnected()
  }

  isStreaming(): boolean {
    return this.streamState.isLive
  }

  // Event handlers
  onStateChange(callback: (state: StreamState) => void): void {
    this.onStateChangeCb = callback
    // Emit current state immediately
    callback(this.streamState)
  }

  onError(callback: (error: StreamError) => void): void {
    this.onErrorCb = callback
  }

  destroy(): void {
    this.log('Destroying streaming core...')
    this.cleanup()
    socketManager.disconnect()
    this.isInitialized = false
  }
}