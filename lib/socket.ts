import { io, Socket } from 'socket.io-client'
import { StreamType } from '@/types'

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
  details?: any
}

class SocketManager {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private isConnecting = false
  private connectionTimeout: NodeJS.Timeout | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    if (this.isConnecting) {
      return this.socket as Socket
    }

    this.isConnecting = true

    try {
      // Multiple server URLs to try - production and development
      const socketUrls = [
        process.env.NEXT_PUBLIC_SOCKET_URL,
        'wss://api.cosmicjs.com/v3/buckets/personal-livestream-platform/socket',
        'ws://localhost:3001',
        'ws://localhost:8080',
        'ws://127.0.0.1:3001'
      ].filter(Boolean)

      const socketUrl = socketUrls[0] || 'ws://localhost:3001'
      
      console.log('Attempting to connect to streaming server:', socketUrl)
      
      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 15000,
        retries: 5,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        forceNew: true,
        upgrade: true,
        rememberUpgrade: true
      })

      // Connection timeout fallback
      this.connectionTimeout = setTimeout(() => {
        if (!this.socket?.connected) {
          console.error('Connection timeout - trying fallback servers')
          this.tryFallbackConnection()
        }
      }, 20000)

      this.socket.on('connect', () => {
        console.log('✅ Socket connected successfully:', this.socket?.id)
        this.isConnecting = false
        this.reconnectAttempts = 0
        
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout)
          this.connectionTimeout = null
        }

        // Start heartbeat to maintain connection
        this.startHeartbeat()
      })

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason)
        this.isConnecting = false
        this.stopHeartbeat()
        
        // Auto-reconnect for certain disconnect reasons
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, try to reconnect
          setTimeout(() => this.connect(), 2000)
        }
      })

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error.message)
        this.isConnecting = false
        this.reconnectAttempts++

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached, trying fallback')
          this.tryFallbackConnection()
        }
      })

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('✅ Socket reconnected after', attemptNumber, 'attempts')
        this.reconnectAttempts = 0
      })

      this.socket.on('reconnect_error', (error) => {
        console.error('❌ Socket reconnection error:', error.message)
      })

      this.socket.on('reconnect_failed', () => {
        console.error('❌ Socket reconnection failed completely')
        this.tryFallbackConnection()
      })

      // Custom heartbeat/ping handler
      this.socket.on('ping', () => {
        this.socket?.emit('pong')
      })

      return this.socket

    } catch (error) {
      console.error('❌ Failed to initialize socket:', error)
      this.isConnecting = false
      this.tryFallbackConnection()
      throw error
    }
  }

  private async tryFallbackConnection(): Promise<void> {
    console.log('🔄 Trying fallback connection methods...')
    
    // Clear existing connection
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    // Try creating a mock streaming server connection for development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Development mode: Creating mock streaming server')
      await this.createMockStreamingServer()
    }

    this.isConnecting = false
  }

  private async createMockStreamingServer(): Promise<void> {
    // Create a minimal mock socket for development/testing
    const mockSocket = {
      connected: true,
      id: 'mock-socket-' + Math.random().toString(36).substr(2, 9),
      emit: (event: string, data?: any) => {
        console.log('📤 Mock emit:', event, data)
        
        // Simulate server responses
        setTimeout(() => {
          if (event === 'start-broadcast') {
            this.socket?.emit('stream-started', {
              sessionId: 'mock-session-' + Date.now(),
              streamType: data?.streamType || 'webcam',
              timestamp: new Date().toISOString()
            })
          }
        }, 1000)
      },
      on: (event: string, callback: Function) => {
        console.log('📥 Mock listener registered for:', event)
      },
      once: (event: string, callback: Function) => {
        console.log('📥 Mock once listener registered for:', event)
      },
      off: (event: string, callback?: Function) => {
        console.log('📥 Mock listener removed for:', event)
      },
      disconnect: () => {
        console.log('🔌 Mock socket disconnected')
      }
    } as any

    this.socket = mockSocket
    console.log('✅ Mock streaming server connected')
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat', {
          timestamp: new Date().toISOString(),
          clientId: this.socket.id
        })
      }
    }, 30000) // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  disconnect(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }
    
    this.stopHeartbeat()
    
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.isConnecting = false
    this.reconnectAttempts = 0
  }

  // Broadcasting events
  startBroadcast(streamType: StreamType): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to streaming server. Please refresh the page and try again.'))
        return
      }

      console.log('🚀 Starting broadcast with type:', streamType)

      // Set up one-time listeners for the response
      const timeout = setTimeout(() => {
        this.socket?.off('stream-started')
        this.socket?.off('stream-error')
        reject(new Error('Stream start timeout - server did not respond within 15 seconds'))
      }, 15000) // 15 second timeout

      this.socket.once('stream-started', (data: StreamStartedEvent) => {
        clearTimeout(timeout)
        console.log('✅ Stream started successfully:', data)
        resolve()
      })

      this.socket.once('stream-error', (error: StreamErrorEvent) => {
        clearTimeout(timeout)
        console.error('❌ Stream start failed:', error)
        reject(new Error(error.message || 'Failed to start stream'))
      })

      // Emit the start broadcast event
      this.socket.emit('start-broadcast', {
        streamType,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        resolution: typeof window !== 'undefined' ? {
          width: window.screen?.width || 1920,
          height: window.screen?.height || 1080
        } : { width: 1920, height: 1080 },
        clientId: this.socket.id
      })
    })
  }

  stopBroadcast(): void {
    if (this.socket?.connected) {
      console.log('🛑 Stopping broadcast')
      this.socket.emit('stop-broadcast', {
        timestamp: new Date().toISOString(),
        clientId: this.socket.id
      })
    }
  }

  // Event listeners
  onStreamStarted(callback: (data: StreamStartedEvent) => void): void {
    this.socket?.on('stream-started', callback)
  }

  onStreamEnded(callback: (data: StreamEndedEvent) => void): void {
    this.socket?.on('stream-ended', callback)
  }

  onStreamError(callback: (error: StreamErrorEvent) => void): void {
    this.socket?.on('stream-error', callback)
  }

  onViewerCount(callback: (count: number) => void): void {
    this.socket?.on('viewer-count', callback)
  }

  onStreamOffer(callback: (offer: RTCSessionDescriptionInit) => void): void {
    this.socket?.on('stream-offer', callback)
  }

  onStreamAnswer(callback: (answer: RTCSessionDescriptionInit) => void): void {
    this.socket?.on('stream-answer', callback)
  }

  onIceCandidate(callback: (candidate: RTCIceCandidateInit) => void): void {
    this.socket?.on('ice-candidate', callback)
  }

  // Send WebRTC signaling data
  sendOffer(offer: RTCSessionDescriptionInit, targetId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('stream-offer', { offer, targetId })
    }
  }

  sendAnswer(answer: RTCSessionDescriptionInit, targetId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('stream-answer', { answer, targetId })
    }
  }

  sendIceCandidate(candidate: RTCIceCandidateInit, targetId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('ice-candidate', { candidate, targetId })
    }
  }

  // Get connection status
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  getSocketId(): string | undefined {
    return this.socket?.id
  }

  getConnectionState(): string {
    if (!this.socket) return 'disconnected'
    if (this.isConnecting) return 'connecting'
    if (this.socket.connected) return 'connected'
    return 'disconnected'
  }
}

// Export singleton instance
export const socketManager = new SocketManager()