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

// Enhanced Mock socket for fallback mode
class MockSocket {
  public id: string = 'mock-' + Math.random().toString(36).substr(2, 9)
  public connected: boolean = true
  private eventHandlers: Map<string, Function[]> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor() {
    log('info', '🔧 Mock socket initialized for fallback mode')
    this.startHeartbeat()
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.trigger('heartbeat-ack', { timestamp: Date.now() })
    }, 30000)
  }

  emit(event: string, data?: any): void {
    log('info', `📤 Mock emit: ${event}`, data)
    
    // Simulate responses for development
    setTimeout(() => {
      switch (event) {
        case 'start-broadcast':
          this.trigger('stream-started', {
            sessionId: 'mock-session-' + Date.now(),
            streamType: data?.streamType || 'webcam',
            timestamp: new Date().toISOString()
          })
          break
        case 'join-stream':
          this.trigger('stream-joined', { 
            sessionId: data?.sessionId || 'mock-session',
            viewerCount: 1
          })
          break
        case 'heartbeat':
          this.trigger('heartbeat-ack', { timestamp: Date.now() })
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
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
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
  private fallbackMode = false
  private eventCallbacks = new Map<string, ((...args: any[]) => void)[]>()
  private currentUrlIndex = 0
  private connectionPromise: Promise<Socket | MockSocket> | null = null
  private urlAttempts = 0
  private broadcastChannel: BroadcastChannel | null = null
  private isDestroyed = false
  private heartbeatInterval: NodeJS.Timeout | null = null
  private connectionRetryTimeout: NodeJS.Timeout | null = null

  constructor() {
    this.setupBroadcastChannel()
  }

  private getSocketUrls(): string[] {
    const urls = STREAM_CONFIG.SERVER_URLS.filter(url => url && url.trim().length > 0)
    
    if (urls.length === 0) {
      log('warn', '⚠️ No WebSocket server URLs configured, enabling fallback mode')
      return []
    }
    
    log('info', `🔍 Available WebSocket URLs: ${urls.join(', ')}`)
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
    if (this.isDestroyed) {
      log('error', '❌ Cannot connect - socket manager destroyed')
      throw new Error('Socket manager destroyed')
    }
    
    if (this.socket?.connected && !this.fallbackMode) {
      log('info', '✅ Already connected to WebSocket server')
      return this.socket
    }
    
    if (this.connectionPromise) {
      log('info', '⏳ Connection already in progress')
      return this.socket as Socket | MockSocket
    }
    
    // Check if we should go straight to fallback mode
    const urls = this.getSocketUrls()
    if (urls.length === 0) {
      log('info', '🔧 No servers configured, entering fallback mode immediately')
      this.enableFallbackMode()
      return this.socket as MockSocket
    }
    
    // Check if we've exhausted all connection attempts
    if (this.currentUrlIndex >= urls.length && this.urlAttempts >= STREAM_CONFIG.CONNECTION.maxUrlAttempts) {
      log('warn', '🔧 All connection attempts exhausted, entering fallback mode')
      this.enableFallbackMode()
      return this.socket as MockSocket
    }
    
    this.connectionPromise = this.establishConnection()
    return this.socket as Socket | MockSocket
  }

  private async establishConnection(): Promise<Socket | MockSocket> {
    if (this.isConnecting || this.isDestroyed) {
      return this.socket as Socket | MockSocket
    }
    
    this.isConnecting = true
    
    try {
      const urls = this.getSocketUrls()
      const url = urls[this.currentUrlIndex]
      
      if (!url) {
        log('warn', '🔧 No URL available, entering fallback mode')
        this.enableFallbackMode()
        return this.socket as MockSocket
      }

      log('info', `🔌 Attempting WebSocket connection to ${url} (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}, URL attempt ${this.urlAttempts + 1}/${STREAM_CONFIG.CONNECTION.maxUrlAttempts})`)

      // Clean up existing socket
      if (this.socket) {
        this.socket.removeAllListeners()
        if ('disconnect' in this.socket) {
          this.socket.disconnect()
        }
      }

      // Create new socket with enhanced configuration
      this.socket = io(url, { 
        ...STREAM_CONFIG.CONNECTION,
        autoConnect: false, // Manual connection for better control
        forceNew: true, // Force new connection
        multiplex: false, // Disable multiplexing for simplicity
        transports: ['websocket'], // Only WebSocket transport
        upgrade: false, // Don't upgrade from polling
        timeout: STREAM_CONFIG.CONNECTION.timeout
      })

      return new Promise((resolve, reject) => {
        if (!this.socket) {
          this.handleConnectionFailure('Socket initialization failed')
          return reject(new Error('Socket init failed'))
        }

        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
          log('warn', `⏰ Connection timeout to ${url}`)
          this.handleConnectionFailure('Connection timeout')
          reject(new Error('Connection timeout'))
        }, STREAM_CONFIG.CONNECTION.timeout)

        const cleanUp = () => {
          this.isConnecting = false
          this.connectionPromise = null
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }
        }

        // Success handler
        this.socket.once('connect', () => {
          cleanUp()
          log('info', `✅ WebSocket connected successfully: ${this.socket?.id}`)
          this.reconnectAttempts = 0
          this.urlAttempts = 0
          this.fallbackMode = false
          this.setupSocketEventHandlers()
          this.startHeartbeat()
          resolve(this.socket as Socket)
        })

        // Error handler
        this.socket.once('connect_error', err => {
          cleanUp()
          log('error', `❌ WebSocket connection error to ${url}:`, err.message)
          this.handleConnectionFailure(err.message)
          reject(err)
        })

        // Disconnect handler
        this.socket.once('disconnect', reason => {
          log('warn', `🔌 WebSocket disconnected from ${url}:`, reason)
          if (!this.fallbackMode && reason !== 'io client disconnect') {
            this.handleConnectionFailure(reason)
          }
        })

        // Start the connection
        try {
          this.socket.connect()
        } catch (error) {
          cleanUp()
          log('error', '❌ Failed to initiate connection:', error)
          this.handleConnectionFailure('Connection initiation failed')
          reject(error)
        }
      })

    } catch (err) {
      this.isConnecting = false
      this.connectionPromise = null
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
    
    // Clear any existing retry timeout
    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout)
      this.connectionRetryTimeout = null
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.currentUrlIndex++
      this.reconnectAttempts = 0
      
      if (this.currentUrlIndex >= urls.length) {
        this.currentUrlIndex = 0
        this.urlAttempts++
        
        if (this.urlAttempts >= STREAM_CONFIG.CONNECTION.maxUrlAttempts) {
          log('warn', '🔧 All connection attempts failed, enabling fallback mode')
          this.enableFallbackMode()
          return
        }
      }
      
      // Try next URL after a delay
      this.connectionRetryTimeout = setTimeout(() => {
        if (!this.isDestroyed) {
          log('info', '🔄 Trying next WebSocket server...')
          this.connect()
        }
      }, STREAM_CONFIG.CONNECTION.reconnectBackoff[0] || 1000)
    } else {
      // Retry same URL with backoff
      const delay = STREAM_CONFIG.CONNECTION.reconnectBackoff[Math.min(this.reconnectAttempts - 1, STREAM_CONFIG.CONNECTION.reconnectBackoff.length - 1)] || 1000
      this.connectionRetryTimeout = setTimeout(() => {
        if (!this.isDestroyed) {
          log('info', `🔄 Retrying WebSocket connection in ${delay}ms...`)
          this.connect()
        }
      }, delay)
    }
  }

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

    // Heartbeat/ping-pong
    sock.on('ping', () => {
      if (this.isDestroyed) return
      sock.emit('pong', { timestamp: Date.now() })
    })

    // Handle incoming messages
    sock.on('message', (data) => {
      log('info', '📨 Received message:', data)
    })

    // Stream events
    sock.on('stream-started', (data: StreamStartedEvent) => {
      log('info', '🎬 Stream started:', data)
    })

    sock.on('stream-ended', (data: StreamEndedEvent) => {
      log('info', '🛑 Stream ended:', data)
    })

    sock.on('stream-joined', (data) => {
      log('info', '👤 Joined stream:', data)
    })

    sock.on('viewer-count', (data) => {
      log('info', '👥 Viewer count update:', data)
    })

    // Connection events
    sock.on('disconnect', (reason: string) => {
      if (!this.fallbackMode) {
        log('warn', '🔌 Socket disconnected:', reason)
        this.stopHeartbeat()
        if (!this.isDestroyed && reason !== 'io client disconnect') {
          // Auto-reconnect unless explicitly disconnected
          this.connectionRetryTimeout = setTimeout(() => {
            if (!this.isDestroyed) {
              this.currentUrlIndex = 0
              this.reconnectAttempts = 0
              this.connect()
            }
          }, 2000)
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

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected && !this.fallbackMode) {
        this.socket.emit('heartbeat', { timestamp: Date.now() })
      }
    }, 30000) // Every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  // Public API methods

  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket && !this.isDestroyed) {
      this.socket.on(event, callback)
    } else {
      // Queue the callback for when connection is established
      if (!this.eventCallbacks.has(event)) {
        this.eventCallbacks.set(event, [])
      }
      this.eventCallbacks.get(event)!.push(callback)
      log('info', `📝 Queued event listener for ${event}`)
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

  emit(event: string, data?: any): void {
    if (this.socket && !this.isDestroyed) {
      this.socket.emit(event, data)
      log('info', `📤 Emitted event: ${event}`, data)
    } else {
      log('warn', `⚠️ Cannot emit ${event} - no socket connection`)
    }
  }

  // Streaming methods
  startBroadcast(streamType: StreamType): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isDestroyed) return reject(new Error('Socket manager destroyed'))
      
      // Ensure connection first
      try {
        this.connect()
      } catch (error) {
        return reject(new Error('Failed to establish connection'))
      }

      const timeout = setTimeout(() => {
        reject(new Error('Stream start timeout'))
      }, 10000) // Longer timeout

      this.socket!.once('stream-started', (data: StreamStartedEvent) => {
        clearTimeout(timeout)
        log('info', '✅ Broadcast started successfully:', data)
        resolve()
      })

      this.socket!.once('stream-error', (err: StreamErrorEvent) => {
        clearTimeout(timeout)
        log('error', '❌ Broadcast start failed:', err)
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
      log('info', '🛑 Broadcast stop signal sent')
    }
  }

  joinStream(sessionId?: string): void {
    if (this.socket) {
      this.socket.emit('join-stream', { 
        sessionId,
        timestamp: new Date().toISOString(),
        clientId: this.socket.id
      })
      log('info', `🚪 Joining stream: ${sessionId || 'any available'}`)
    }
  }

  // Connection management
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

  disconnect(): void {
    this.isDestroyed = true
    
    // Clear timeouts
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }
    
    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout)
      this.connectionRetryTimeout = null
    }
    
    this.stopHeartbeat()
    
    if (this.socket) {
      this.socket.removeAllListeners()
      if ('disconnect' in this.socket) {
        this.socket.disconnect()
      }
    }
    this.socket = null
    this.eventCallbacks.clear()
    this.broadcastChannel?.close()
    
    log('info', '🧹 Socket manager disconnected and cleaned up')
  }

  isConnected(): boolean {
    return (this.socket?.connected || this.fallbackMode) && !this.isDestroyed
  }

  getSocketId(): string | undefined {
    return this.socket?.id
  }

  // Event listener convenience methods
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

  // WebRTC signaling
  sendOffer(offer: RTCSessionDescriptionInit, targetId?: string): void {
    this.emit('stream-offer', { offer, targetId })
  }

  sendAnswer(answer: RTCSessionDescriptionInit, targetId: string): void {
    this.emit('stream-answer', { answer, targetId })
  }

  sendIceCandidate(candidate: RTCIceCandidateInit, targetId?: string): void {
    this.emit('ice-candidate', { candidate, targetId })
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
}

export const socketManager = new SocketManager()