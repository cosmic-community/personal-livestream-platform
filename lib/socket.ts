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

class SocketManager {
  private socket: Socket | null = null
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
  private connectionPromise: Promise<Socket> | null = null
  private urlAttempts = 0
  private broadcastChannel: BroadcastChannel | null = null
  private isDestroyed = false

  constructor() {
    this.setupBroadcastChannel()
  }

  private getSocketUrls(): string[] {
    return STREAM_CONFIG.SERVER_URLS
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

  connect(): Socket {
    if (this.isDestroyed) throw new Error('Socket manager destroyed')
    if (this.socket?.connected) return this.socket
    if (this.connectionPromise) return this.socket as Socket
    this.connectionPromise = this.establishConnection()
    return this.socket as Socket
  }

  private async establishConnection(): Promise<Socket> {
    if (this.isConnecting || this.isDestroyed) return this.socket as Socket
    this.isConnecting = true

    try {
      const urls = this.getSocketUrls()
      if (this.currentUrlIndex >= urls.length && this.urlAttempts >= STREAM_CONFIG.CONNECTION.maxUrlAttempts) {
        log('warn', 'URLs exhausted, entering fallback')
        this.enableFallbackMode()
        return this.socket as Socket
      }

      const url = urls[this.currentUrlIndex] || 'ws://localhost:3001'
      log('info', `Connecting to ${url}`)

      this.socket?.removeAllListeners()
      this.socket?.disconnect()
      this.socket = io(url, { ...STREAM_CONFIG.CONNECTION, autoConnect: true })

      return new Promise((resolve, reject) => {
        if (!this.socket) return reject(new Error('Socket init failed'))

        this.connectionTimeout = setTimeout(() => {
          this.handleConnectionFailure('timeout')
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
          log('info', 'Socket connected:', this.socket?.id)
          this.reconnectAttempts = 0
          this.fallbackMode = false
          this.setupSocketEventHandlers()
          resolve(this.socket as Socket)
        })

        this.socket.once('connect_error', err => {
          cleanUp()
          this.handleConnectionFailure(err.message)
          reject(err)
        })

        this.socket.once('disconnect', reason => {
          cleanUp()
          this.handleConnectionFailure(reason)
        })
      })

    } catch (err) {
      this.handleConnectionFailure('init error')
      throw err
    }
  }

  private handleConnectionFailure(reason: string): void {
    this.isConnecting = false
    this.reconnectAttempts++
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.currentUrlIndex++
      this.reconnectAttempts = 0
      if (this.currentUrlIndex >= this.getSocketUrls().length) {
        this.enableFallbackMode()
      } else {
        setTimeout(() => this.connect(), STREAM_CONFIG.CONNECTION.reconnectBackoff[0])
      }
    } else {
      setTimeout(() => this.connect(), STREAM_CONFIG.CONNECTION.reconnectBackoff[this.reconnectAttempts - 1])
    }
  }

  private setupSocketEventHandlers(): void {
    const sock = this.socket
    if (!sock) return

    sock.on('ping', () => {
      if (this.isDestroyed) return
      sock.emit('pong', { timestamp: Date.now() })
    })

    sock.on('join-room', (payload: JoinRoomPayload) => {
      log('info', 'Room joined:', payload)
    })

    sock.on('signal', (payload: SignalPayload) => {
      log('info', 'Signal:', payload)
    })

    // ... other on(...) handlers ...
  }

  // Core emit methods
  joinRoom(roomId: string, userId: string, streamId: string): void {
    this.socket?.emit('join-room', { roomId, userId, streamId })
  }

  sendSignal(toId: string, fromId: string, signalData: any): void {
    this.socket?.emit('signal', { toId, fromId, signalData })
  }

  // Public convenience listeners
  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket && !this.isDestroyed) {
      this.socket.on(event, callback)
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket && !this.isDestroyed) {
      if (callback) this.socket.off(event, callback)
      else this.socket.off(event)
    }
  }

  forceReconnect(): void {
    if (this.isDestroyed) return
    this.disconnect()
    this.isDestroyed = false
    this.setupBroadcastChannel()
    setTimeout(() => {
      this.currentUrlIndex = 0
      this.urlAttempts = 0
      this.reconnectAttempts = 0
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

  getConnectionHealth(): { connected: boolean; fallbackMode: boolean; reconnectAttempts: number; currentUrl: string; socketId?: string } {
    const urls = this.getSocketUrls()
    return {
      connected: this.isConnected(),
      fallbackMode: this.fallbackMode,
      reconnectAttempts: this.reconnectAttempts,
      currentUrl: urls[this.currentUrlIndex] || 'none',
      socketId: this.socket?.id
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
      if (this.isDestroyed) return reject(new Error('Destroyed'))
      if (!this.socket || !this.socket.connected) return reject(new Error('Not connected'))
      const timeout = setTimeout(() => reject(new Error('Stream start timeout')), 6000)
      this.socket.once('stream-started', (data: StreamStartedEvent) => {
        clearTimeout(timeout)
        resolve()
      })
      this.socket.once('stream-error', (err: StreamErrorEvent) => {
        clearTimeout(timeout)
        reject(new Error(err.message))
      })
      this.socket.emit('start-broadcast', {
        streamType,
        timestamp: new Date().toISOString(),
        clientId: this.socket.id,
        fallbackMode: this.fallbackMode
      })
    })
  }

  stopBroadcast(): void {
    this.socket?.emit('stop-broadcast', { timestamp: new Date().toISOString(), clientId: this.socket?.id, fallbackMode: this.fallbackMode })
  }

  // Signaling
  sendOffer(offer: RTCSessionDescriptionInit, targetId?: string): void {
    this.socket?.emit('stream-offer', { offer, targetId })
  }

  sendAnswer(answer: RTCSessionDescriptionInit, targetId: string): void {
    this.socket?.emit('stream-answer', { answer, targetId })
  }

  sendIceCandidate(candidate: RTCIceCandidateInit, targetId?: string): void {
    this.socket?.emit('ice-candidate', { candidate, targetId })
  }

  disconnect(): void {
    this.isDestroyed = true
    this.socket?.removeAllListeners()
    this.socket?.disconnect()
    this.socket = null
    this.eventCallbacks.clear()
    this.broadcastChannel?.close()
  }

  isConnected(): boolean {
    return (this.socket?.connected || this.fallbackMode) && !this.isDestroyed
  }

  getSocketId(): string | undefined {
    return this.socket?.id
  }
}

export const socketManager = new SocketManager()
