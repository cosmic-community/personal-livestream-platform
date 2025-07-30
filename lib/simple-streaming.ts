import { io, Socket } from 'socket.io-client'

export interface StreamConfig {
  serverUrl?: string
  fallbackMode?: boolean
  debug?: boolean
}

export interface StreamState {
  isConnected: boolean
  isStreaming: boolean
  viewerCount: number
  streamId?: string
  error?: string
}

export interface StreamEvents {
  onStateChange?: (state: StreamState) => void
  onError?: (error: string) => void
  onViewerCount?: (count: number) => void
}

class SimpleStreamingClient {
  private socket: Socket | null = null
  private config: StreamConfig
  private events: StreamEvents
  private state: StreamState = {
    isConnected: false,
    isStreaming: false,
    viewerCount: 0
  }

  constructor(config: StreamConfig = {}, events: StreamEvents = {}) {
    this.config = {
      serverUrl: config.serverUrl || 'ws://localhost:3001',
      fallbackMode: config.fallbackMode || false,
      debug: config.debug || false
    }
    this.events = events
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[SimpleStreaming] ${message}`, data || '')
    }
  }

  private updateState(updates: Partial<StreamState>): void {
    this.state = { ...this.state, ...updates }
    this.events.onStateChange?.(this.state)
  }

  private emitError(error: string): void {
    this.updateState({ error })
    this.events.onError?.(error)
  }

  async connect(): Promise<boolean> {
    try {
      if (this.socket?.connected) {
        return true
      }

      this.log('Connecting to server', this.config.serverUrl)

      this.socket = io(this.config.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000
      })

      return new Promise((resolve) => {
        if (!this.socket) {
          resolve(false)
          return
        }

        this.socket.once('connect', () => {
          this.log('Connected successfully')
          this.updateState({ isConnected: true, error: undefined })
          this.setupEventListeners()
          resolve(true)
        })

        this.socket.once('connect_error', (error) => {
          this.log('Connection failed', error.message)
          this.emitError('Connection failed: ' + error.message)
          resolve(false)
        })

        setTimeout(() => {
          if (!this.state.isConnected) {
            this.emitError('Connection timeout')
            resolve(false)
          }
        }, 15000)
      })
    } catch (error) {
      this.emitError('Connection error: ' + (error instanceof Error ? error.message : 'Unknown error'))
      return false
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return

    this.socket.on('disconnect', () => {
      this.log('Disconnected from server')
      this.updateState({ isConnected: false, isStreaming: false })
    })

    this.socket.on('stream-started', (data: { sessionId: string }) => {
      this.log('Stream started', data)
      this.updateState({ 
        isStreaming: true, 
        streamId: data.sessionId,
        error: undefined 
      })
    })

    this.socket.on('stream-ended', () => {
      this.log('Stream ended')
      this.updateState({ 
        isStreaming: false, 
        streamId: undefined,
        viewerCount: 0 
      })
    })

    this.socket.on('viewer-count', (count: number) => {
      this.log('Viewer count updated', count)
      this.updateState({ viewerCount: count })
      this.events.onViewerCount?.(count)
    })

    this.socket.on('stream-error', (error: { message: string }) => {
      this.log('Stream error', error)
      this.emitError(error.message)
    })

    this.socket.on('stream-offer', (offer: RTCSessionDescriptionInit) => {
      this.log('Received stream offer')
      this.handleStreamOffer(offer)
    })
  }

  private handleStreamOffer(offer: RTCSessionDescriptionInit): void {
    // This will be implemented by specific components
    this.log('Stream offer received', offer.type)
  }

  async startBroadcast(streamType: 'webcam' | 'screen' | 'both' = 'webcam'): Promise<boolean> {
    if (!this.socket?.connected) {
      this.emitError('Not connected to server')
      return false
    }

    try {
      this.log('Starting broadcast', streamType)
      
      // Simple emit with just the data object
      this.socket.emit('start-broadcast', {
        streamType,
        timestamp: new Date().toISOString()
      })

      return true
    } catch (error) {
      this.emitError('Failed to start broadcast: ' + (error instanceof Error ? error.message : 'Unknown error'))
      return false
    }
  }

  stopBroadcast(): void {
    if (!this.socket?.connected) return

    try {
      this.log('Stopping broadcast')
      this.socket.emit('stop-broadcast', {
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      this.log('Error stopping broadcast', error)
    }
  }

  joinStream(streamId?: string): void {
    if (!this.socket?.connected) {
      this.emitError('Not connected to server')
      return
    }

    try {
      this.log('Joining stream', streamId)
      this.socket.emit('join-stream', {
        sessionId: streamId,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      this.emitError('Failed to join stream: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  leaveStream(): void {
    if (!this.socket?.connected) return

    try {
      this.log('Leaving stream')
      this.socket.emit('leave-stream', {
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      this.log('Error leaving stream', error)
    }
  }

  sendOffer(offer: RTCSessionDescriptionInit): void {
    if (!this.socket?.connected) return

    try {
      this.socket.emit('stream-offer', offer)
    } catch (error) {
      this.log('Error sending offer', error)
    }
  }

  sendAnswer(answer: RTCSessionDescriptionInit): void {
    if (!this.socket?.connected) return

    try {
      this.socket.emit('stream-answer', answer)
    } catch (error) {
      this.log('Error sending answer', error)
    }
  }

  sendIceCandidate(candidate: RTCIceCandidateInit): void {
    if (!this.socket?.connected) return

    try {
      this.socket.emit('ice-candidate', candidate)
    } catch (error) {
      this.log('Error sending ICE candidate', error)
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.updateState({ 
      isConnected: false, 
      isStreaming: false, 
      viewerCount: 0,
      streamId: undefined 
    })
  }

  getState(): StreamState {
    return { ...this.state }
  }

  isConnected(): boolean {
    return this.state.isConnected
  }

  isStreaming(): boolean {
    return this.state.isStreaming
  }
}

export { SimpleStreamingClient }