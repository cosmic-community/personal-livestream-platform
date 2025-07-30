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

export class SimpleStreamingClient {
  private ws: WebSocket | null = null
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
      if (this.ws?.readyState === WebSocket.OPEN) {
        return true
      }

      this.log('Connecting to server', this.config.serverUrl)

      this.ws = new WebSocket(this.config.serverUrl + '/ws')

      return new Promise((resolve) => {
        if (!this.ws) {
          resolve(false)
          return
        }

        this.ws.onopen = () => {
          this.log('Connected successfully')
          this.updateState({ isConnected: true, error: undefined })
          this.setupEventListeners()
          resolve(true)
        }

        this.ws.onerror = (error) => {
          this.log('Connection failed', error)
          this.emitError('Connection failed')
          resolve(false)
        }

        setTimeout(() => {
          if (!this.state.isConnected) {
            this.emitError('Connection timeout')
            resolve(false)
          }
        }, 10000)
      })
    } catch (error) {
      this.emitError('Connection error: ' + (error instanceof Error ? error.message : 'Unknown error'))
      return false
    }
  }

  private setupEventListeners(): void {
    if (!this.ws) return

    this.ws.onclose = () => {
      this.log('Disconnected from server')
      this.updateState({ isConnected: false, isStreaming: false })
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        this.handleMessage(message)
      } catch (error) {
        this.log('Error parsing message', error)
      }
    }
  }

  private handleMessage(message: any): void {
    this.log('Received message', message.type)

    switch (message.type) {
      case 'stream-started':
        this.updateState({ 
          isStreaming: true, 
          streamId: message.sessionId,
          error: undefined 
        })
        break

      case 'stream-ended':
        this.updateState({ 
          isStreaming: false, 
          streamId: undefined,
          viewerCount: 0 
        })
        break

      case 'viewer-count':
        this.updateState({ viewerCount: message.count })
        this.events.onViewerCount?.(message.count)
        break

      case 'error':
        this.emitError(message.message)
        break
    }
  }

  async startBroadcast(streamType: 'webcam' | 'screen' | 'both' = 'webcam'): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.emitError('Not connected to server')
      return false
    }

    try {
      this.log('Starting broadcast', streamType)
      
      this.ws.send(JSON.stringify({
        type: 'start-broadcast',
        streamType,
        timestamp: new Date().toISOString()
      }))

      return true
    } catch (error) {
      this.emitError('Failed to start broadcast: ' + (error instanceof Error ? error.message : 'Unknown error'))
      return false
    }
  }

  stopBroadcast(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    try {
      this.log('Stopping broadcast')
      this.ws.send(JSON.stringify({
        type: 'stop-broadcast',
        timestamp: new Date().toISOString()
      }))
    } catch (error) {
      this.log('Error stopping broadcast', error)
    }
  }

  joinStream(streamId?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.emitError('Not connected to server')
      return
    }

    try {
      this.log('Joining stream', streamId)
      this.ws.send(JSON.stringify({
        type: 'join-stream',
        sessionId: streamId,
        timestamp: new Date().toISOString()
      }))
    } catch (error) {
      this.emitError('Failed to join stream: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
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