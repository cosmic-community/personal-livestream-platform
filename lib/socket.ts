import { io, Socket } from 'socket.io-client'
import { StreamType } from '@/types'
import { STREAM_CONFIG, log } from '@/lib/stream-config'

// Payload interfaces
interface StreamStartedEvent {
  sessionId: string
  streamType: StreamType
  timestamp: string
}

interface StreamEndedEvent {
  sessionId: string
  timestamp: string
}

interface StreamErrorEvent {
  code: string
  message: string
  timestamp: string
  details?: any
}

interface JoinRoomPayload {
  roomId: string
  userId: string
  streamId: string
}

interface SignalPayload {
  toId: string
  fromId: string
  signalData: any
}

// Mock socket for fallback mode
class MockSocket {
  public id: string = 'mock-' + Math.random().toString(36).substr(2, 9)
  public connected: boolean = true
  private eventHandlers: Map<string, Function[]> = new Map()

  constructor() {
    log('info', '🔧 Mock socket initialized for fallback mode')
  }

  emit(event: string, data?: any): void {
    log('info', `📤 Mock emit: ${event}`, data) // CHANGED from 'debug' to 'info'
    
    // Simulate some responses for development
    setTimeout(() => {
      switch (event) {
        case 'start-broadcast':
          this.trigger('stream-started', {
            sessionId: 'mock-session-' + Date.now(),
            streamType: data?.streamType || 'webcam',
            timestamp: new Date().toISOString()
          })
          break
        case 'join-room':
          this.trigger('room-joined', { roomId: data?.roomId })
          break
      }
    }, 100)
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  off(event: string, handler?: Function): void {
    if (!this.eventHandlers.has(event)) return
    
    if (handler) {
      const handlers = this.eventHandlers.get(event)!
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    } else {
      this.eventHandlers.delete(event)
    }
  }

  once(event: string, handler: Function): void {
    const onceHandler = (...args: any[]) => {
      handler(...args)
      this.off(event, onceHandler)
    }
    this.on(event, onceHandler)
  }

  removeAllListeners(): void {
    this.eventHandlers.clear()
  }

  disconnect(): void {
    this.connected = false
    log('info', '🔧 Mock socket disconnected')
  }

  private trigger(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          log('error', 'Error in mock socket handler:', error)
        }
      })
    }
  }
}

class SocketManager {
  private socket: Socket | MockSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = STREAM_CONFIG.CONNECTION.maxRetries
  private isConnecting = false
  private connectionTimeout: NodeJS.Timeout | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  private fallbackMode = false
  private eventCallbacks = new Map<string, ((...args: any[]) => void)[]>()
  private triggerEvent: ((event: string, data?: any) => void) | null = null
  private fallbackInterval: NodeJS.Timeout | null = null
  private currentUrlIndex = 0
  private connectionPromise: Promise<Socket | MockSocket> | null = null
  private urlAttempts = 0
  private broadcastChannel: BroadcastChannel | null = null
  private isDestroyed = false

  constructor() {
    this.setupBroadcastChannel()
  }

  private getSocketUrls(): string[] {
    const urls = STREAM_CONFIG.SERVER_URLS
    
    // If no URLs configured, use fallback mode immediately
    if (urls.length === 0) {
      log('warn', '⚠️ No WebSocket server URLs configured, enabling fallback mode')
      return []
    }
    
    return urls
  }

  private setupBroadcastChannel(): void {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window && STREAM_CONFIG.FALLBACK.enableBroadcastChannel) {
        this.broadcastChannel = new BroadcastChannel('livestream-socket')
        this.broadcastChannel.addEventListener('message', event => {
          const { type, data } = event.data
          this.triggerEvent?.(type, data)
        })
        log('info', '📡 BroadcastChannel initialized')
      }
    } catch (e) {
      log('warn', 'BroadcastChannel setup failed', e)
    }
  }

  connect(): Socket | MockSocket {
    if (this.isDestroyed) throw new Error('Socket manager destroyed')
    if (this.socket?.connected) return this.socket
    if (this.connectionPromise) return this.socket as Socket | MockSocket
    
    // Check if we should go straight to fallback mode
    const urls = this.getSocketUrls()
    if (urls.length === 0 || (this.currentUrlIndex >= urls.length && this.urlAttempts >= STREAM_CONFIG.CONNECTION.maxUrlAttempts)) {
      log('info', '🔧 No servers available, entering fallback mode immediately')
      this.enableFallbackMode()
      return this.socket as MockSocket
    }
    
    this.connectionPromise = this.establishConnection()
    return this.socket as Socket | MockSocket
  }

  private async establishConnection(): Promise<Socket | MockSocket> {
    if (this.isConnecting || this.isDestroyed) return this.socket as Socket | MockSocket
    this.isConnecting = true

    try {
      const urls = this.getSocketUrls()
      
      // Check if we've exhausted all URLs
      if (this.currentUrlIndex >= urls.length && this.urlAttempts >= STREAM_CONFIG.CONNECTION.maxUrlAttempts) {
        log('warn', '🔧 All URLs exhausted, entering fallback mode')
        this.enableFallbackMode()
        return this.socket as MockSocket
      }

      const url = urls[this.currentUrlIndex]
      if (!url) {
        log('warn', '🔧 No URL available, entering fallback mode')
        this.enableFallbackMode()
        return this.socket as MockSocket
      }

      log('info', `🔌 Attempting connection to ${url} (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`)

      this.socket?.removeAllListeners()
      if (this.socket && 'disconnect' in this.socket) {
        this.socket.disconnect()
      }

      // Create real socket connection
      this.socket = io(url, { 
        ...STREAM_CONFIG.CONNECTION,
        autoConnect: true
      })

      return new Promise((resolve, reject) => {
        if (!this.socket) {
          this.handleConnectionFailure('Socket initialization failed')
          return reject(new Error('Socket init failed'))
        }

        this.connectionTimeout = setTimeout(() => {
          log('warn', `⏰ Connection timeout to ${url}`)
          this.handleConnectionFailure('Connection timeout')
          reject(new Error('Connection timeout'))
        }, STREAM_CONFIG.CONNECTION.timeout + 2000)

        const cleanUp = () => {
          this.isConnecting = false
          this.connectionPromise = null
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }
        }

        this.socket.once('connect', () => {
          cleanUp()
          log('info', '✅ Socket connected:', this.socket?.id)
          this.reconnectAttempts = 0
          this.urlAttempts = 0
          this.fallbackMode = false
          this.setupSocketEventHandlers()
          resolve(this.socket as Socket)
        })

        this.socket.once('connect_error', err => {
          cleanUp()
          log('error', `❌ Connection error to ${url}:`, err.message)
          this.handleConnectionFailure(err.message)
          reject(err)
        })

        this.socket.once('disconnect', reason => {
          cleanUp()
          log('warn', `🔌 Disconnected from ${url}:`, reason)
          this.handleConnectionFailure(reason)
        })
      })

    } catch (err) {
      log('error', '❌ Error in establishConnection:', err)
      this.handleConnectionFailure('Connection establishment error')
      throw err
    }
  }

  private handleConnectionFailure(reason: string): void {
    this.isConnecting = false
    this.reconnectAttempts++
    
    const urls = this.getSocketUrls()
    log('warn', `⚠️ Connection failed: ${reason} (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.currentUrlIndex++
      this.reconnectAttempts = 0
      this.urlAttempts++
      
      if (this.currentUrlIndex >= urls.length) {
        this.currentUrlIndex = 0
        
        if (this.urlAttempts >= STREAM_CONFIG.CONNECTION.maxUrlAttempts) {
          log('warn', '🔧 All connection attempts failed, enabling fallback mode')
          this.enableFallbackMode()
          return
        }
      }
      
      // Try next URL after a short delay
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.connect()
        }
      }, STREAM_CONFIG.CONNECTION.reconnectBackoff[0] || 1000)
    } else {
      // Retry same URL with backoff
      const delay = STREAM_CONFIG.CONNECTION.reconnectBackoff[Math.min(this.reconnectAttempts - 1, STREAM_CONFIG.CONNECTION.reconnectBackoff.length - 1)] || 1000
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.connect()
        }
      }, delay)
    }
  }

  /** Enable fallback mode with mock socket */
  private enableFallbackMode(): void {
    this.fallbackMode = true
    this.isConnecting = false
    this.connectionPromise = null
    
    if (this.socket) {
      this.socket.removeAllListeners()
      if ('disconnect' in this.socket) {
        this.socket.disconnect()
      }
    }
    
    // Create mock socket for offline functionality
    this.socket = new MockSocket()
    this.setupSocketEventHandlers()
    
    log('info', '🔧 Fallback mode enabled with mock socket')
  }

  private setupSocketEventHandlers(): void {
    const sock = this.socket
    if (!sock) return

    sock.on('ping', () => {
      if (this.isDestroyed) return
      sock.emit('pong', { timestamp: Date.now() })
    })

    sock.on('join-room', (payload: JoinRoomPayload) => {
      log('info', '🚪 Room joined:', payload)
    })

    sock.on('signal', (payload: SignalPayload) => {
      log('info', '📡 Signal received:', payload)
    })

    sock.on('disconnect', (reason: string) => {
      if (!this.fallbackMode) {
        log('warn', '🔌 Socket disconnected:', reason)
        if (!this.isDestroyed && reason !== 'io client disconnect') {
          // Attempt to reconnect unless explicitly disconnected
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.currentUrlIndex = 0
              this.reconnectAttempts = 0
              this.connect()
            }
          }, 1000)
        }
      }
    })

    sock.on('connect_error', (error: Error) => {
      if (!this.fallbackMode) {
        log('error', '❌ Socket connection error:', error.message)
      }
    })

    log('info', '✅ Socket event handlers setup complete')
  }

  // Core emit methods
  joinRoom(roomId: string, userId: string, streamId: string): void {
    if (this.socket) {
      this.socket.emit('join-room', { roomId, userId, streamId })
    } else {
      log('warn', '⚠️ Cannot join room - no socket connection')
    }
  }

  sendSignal(toId: string, fromId: string, signalData: any): void {
    if (this.socket) {
      this.socket.emit('signal', { toId, fromId, signalData })
    } else {
      log('warn', '⚠️ Cannot send signal - no socket connection')
    }
  }

  // Public convenience listeners
  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket && !this.isDestroyed) {
      this.socket.on(event, callback)
    } else {
      log('info', `📝 Queuing event listener for ${event}`) // CHANGED from 'debug' to 'info'
      // Queue the callback for when connection is established
      if (!this.eventCallbacks.has(event)) {
        this.eventCallbacks.set(event, [])
      }
      this.eventCallbacks.get(event)!.push(callback)
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket && !this.isDestroyed) {
      if (callback) this.socket.off(event, callback)
      else this.socket.off(event)
    }
    
    // Also remove from queued callbacks
    if (callback && this.eventCallbacks.has(event)) {
      const callbacks = this.eventCallbacks.get(event)!
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  forceReconnect(): void {
    if (this.isDestroyed) return
    
    log('info', '🔄 Forcing reconnection...')
    this.disconnect()
    this.isDestroyed = false
    this.fallbackMode = false
    this.currentUrlIndex = 0
    this.urlAttempts = 0
    this.reconnectAttempts = 0
    this.setupBroadcastChannel()
    
    setTimeout(() => {
      this.connect()
    }, 1000)
  }

  isFallbackMode(): boolean {
    return this.fallbackMode && !this.isDestroyed
  }

  getConnectionState(): string {
    if (this.isDestroyed) return 'destroyed'
    if (!this.socket) return 'disconnected'
    if (this.fallbackMode) return 'fallback'
    if (this.isConnecting) return 'connecting'
    if (this.socket.connected) return 'connected'
    return 'disconnected'
  }

  getConnectionHealth(): { 
    connected: boolean
    fallbackMode: boolean
    reconnectAttempts: number
    currentUrl: string
    socketId?: string
    urlAttempts: number
    availableUrls: number
  } {
    const urls = this.getSocketUrls()
    return {
      connected: this.isConnected(),
      fallbackMode: this.fallbackMode,
      reconnectAttempts: this.reconnectAttempts,
      currentUrl: urls[this.currentUrlIndex] || 'none',
      socketId: this.socket?.id,
      urlAttempts: this.urlAttempts,
      availableUrls: urls.length
    }
  }

  // High-level event helpers
  onStreamStarted(callback: (data: StreamStartedEvent) => void): void {
    this.on('stream-started', callback)
  }

  onStreamEnded(callback: (data: StreamEndedEvent) => void): void {
    this.on('stream-ended', callback)
  }

  onStreamError(callback: (error: StreamErrorEvent) => void): void {
    this.on('stream-error', callback)
  }

  onViewerCount(callback: (count: number) => void): void {
    this.on('viewer-count', callback)
  }

  onStreamOffer(callback: (data: any) => void): void {
    this.on('stream-offer', callback)
  }

  onStreamAnswer(callback: (data: any) => void): void {
    this.on('stream-answer', callback)
  }

  onIceCandidate(callback: (data: any) => void): void {
    this.on('ice-candidate', callback)
  }

  // Broadcast control
  startBroadcast(streamType: StreamType): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isDestroyed) return reject(new Error('Socket manager destroyed'))
      
      if (!this.socket) {
        // Try to connect first
        try {
          this.connect()
        } catch (error) {
          return reject(new Error('Failed to establish connection'))
        }
      }

      const timeout = setTimeout(() => {
        reject(new Error('Stream start timeout'))
      }, 6000)

      this.socket!.once('stream-started', (data: StreamStartedEvent) => {
        clearTimeout(timeout)
        resolve()
      })

      this.socket!.once('stream-error', (err: StreamErrorEvent) => {
        clearTimeout(timeout)
        reject(new Error(err.message))
      })

      this.socket!.emit('start-broadcast', {
        streamType,
        timestamp: new Date().toISOString(),
        clientId: this.socket!.id,
        fallbackMode: this.fallbackMode
      })
    })
  }

  stopBroadcast(): void {
    if (this.socket) {
      this.socket.emit('stop-broadcast', { 
        timestamp: new Date().toISOString(), 
        clientId: this.socket.id, 
        fallbackMode: this.fallbackMode 
      })
    }
  }

  // Signaling
  sendOffer(offer: RTCSessionDescriptionInit, targetId?: string): void {
    if (this.socket) {
      this.socket.emit('stream-offer', { offer, targetId })
    } else {
      log('warn', '⚠️ Cannot send offer - no socket connection')
    }
  }

  sendAnswer(answer: RTCSessionDescriptionInit, targetId: string): void {
    if (this.socket) {
      this.socket.emit('stream-answer', { answer, targetId })
    } else {
      log('warn', '⚠️ Cannot send answer - no socket connection')
    }
  }

  sendIceCandidate(candidate: RTCIceCandidateInit, targetId?: string): void {
    if (this.socket) {
      this.socket.emit('ice-candidate', { candidate, targetId })
    } else {
      log('warn', '⚠️ Cannot send ICE candidate - no socket connection')
    }
  }

  disconnect(): void {
    this.isDestroyed = true
    if (this.socket) {
      this.socket.removeAllListeners()
      if ('disconnect' in this.socket) {
        this.socket.disconnect()
      }
    }
    this.socket = null
    this.eventCallbacks.clear()
    this.broadcastChannel?.close()
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval)
      this.fallbackInterval = null
    }
  }

  isConnected(): boolean {
    return (this.socket?.connected || this.fallbackMode) && !this.isDestroyed
  }

  getSocketId(): string | undefined {
    return this.socket?.id
  }
}

export const socketManager = new SocketManager()