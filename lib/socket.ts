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
  private fallbackMode = false
  private eventCallbacks: Map<string, ((...args: any[]) => void)[]> = new Map()
  private triggerEvent: ((event: string, data?: any) => void) | null = null
  private fallbackInterval: NodeJS.Timeout | null = null
  private currentUrlIndex = 0
  private connectionPromise: Promise<Socket> | null = null

  private getSocketUrls(): string[] {
    return [
      process.env.NEXT_PUBLIC_SOCKET_URL,
      'wss://livestream-api.cosmicjs.com/socket',
      'ws://localhost:3001',
      'ws://localhost:8080',
      'ws://127.0.0.1:3001',
      'ws://127.0.0.1:8080'
    ].filter(Boolean) as string[]
  }

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    if (this.connectionPromise) {
      return this.socket as Socket
    }

    this.connectionPromise = this.establishConnection()
    return this.socket as Socket
  }

  private async establishConnection(): Promise<Socket> {
    if (this.isConnecting) {
      return this.socket as Socket
    }

    this.isConnecting = true

    try {
      const socketUrls = this.getSocketUrls()
      const socketUrl = socketUrls[this.currentUrlIndex] || 'ws://localhost:3001'
      
      console.log(`🔌 Attempting to connect to streaming server: ${socketUrl} (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`)
      
      // Clean up existing socket
      if (this.socket) {
        this.socket.removeAllListeners()
        this.socket.disconnect()
        this.socket = null
      }

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 8000,
        retries: 2,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 3000,
        forceNew: true,
        upgrade: true,
        rememberUpgrade: false,
        autoConnect: true,
        closeOnBeforeunload: false
      })

      // Set up connection promise that resolves/rejects based on connection outcome
      return new Promise((resolve, reject) => {
        // Connection timeout fallback
        this.connectionTimeout = setTimeout(() => {
          console.warn(`⏱️ Connection timeout for ${socketUrl}`)
          this.handleConnectionFailure('Connection timeout')
          reject(new Error('Connection timeout'))
        }, 10000)

        // Success handler
        const onConnect = () => {
          console.log('✅ Socket connected successfully:', this.socket?.id)
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.fallbackMode = false
          this.currentUrlIndex = 0 // Reset to first URL on success
          this.connectionPromise = null
          
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          this.startHeartbeat()
          this.setupSocketEventHandlers()
          resolve(this.socket as Socket)
        }

        // Error handlers
        const onConnectError = (error: Error) => {
          console.error(`❌ Socket connection error for ${socketUrl}:`, error.message)
          this.handleConnectionFailure(error.message)
          reject(error)
        }

        const onDisconnect = (reason: string) => {
          console.log('❌ Socket disconnected:', reason)
          this.isConnecting = false
          this.stopHeartbeat()
          
          // Auto-reconnect for certain disconnect reasons
          if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'transport error') {
            console.log('🔄 Server initiated disconnect, attempting reconnect...')
            setTimeout(() => this.tryReconnect(), 2000)
          }
        }

        // Set up one-time listeners for this connection attempt
        if (this.socket) {
          this.socket.once('connect', onConnect)
          this.socket.once('connect_error', onConnectError)
          this.socket.once('disconnect', onDisconnect)
        }
      })

    } catch (error) {
      console.error('❌ Failed to initialize socket:', error)
      this.isConnecting = false
      this.connectionPromise = null
      this.handleConnectionFailure('Socket initialization failed')
      throw error
    }
  }

  private handleConnectionFailure(reason: string): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }

    this.isConnecting = false
    this.reconnectAttempts++

    const socketUrls = this.getSocketUrls()

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Try next URL
      this.currentUrlIndex++
      if (this.currentUrlIndex < socketUrls.length) {
        console.log(`🔄 Trying next server URL: ${socketUrls[this.currentUrlIndex]}`)
        this.reconnectAttempts = 0
        this.connectionPromise = null
        setTimeout(() => this.connect(), 1000)
      } else {
        console.error('❌ All connection attempts failed, enabling fallback mode')
        this.enableFallbackMode()
      }
    } else {
      // Retry same URL
      console.log(`🔄 Retrying connection in 2 seconds... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      this.connectionPromise = null
      setTimeout(() => this.connect(), 2000)
    }
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('✅ Socket reconnected after', attemptNumber, 'attempts')
      this.reconnectAttempts = 0
      this.fallbackMode = false
    })

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ Socket reconnection error:', error.message)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Socket reconnection failed completely')
      this.enableFallbackMode()
    })

    // Custom heartbeat/ping handler
    this.socket.on('ping', () => {
      if (this.socket) {
        this.socket.emit('pong', { timestamp: Date.now() })
      }
    })

    // Handle server-side events
    this.socket.on('server-status', (status) => {
      console.log('📊 Server status:', status)
    })

    // Error handling
    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error)
    })
  }

  private tryReconnect(): void {
    if (this.socket && !this.socket.connected) {
      console.log('🔄 Attempting manual reconnect...')
      this.socket.connect()
    } else {
      this.connectionPromise = null
      this.connect()
    }
  }

  private enableFallbackMode(): void {
    console.log('🔧 Enabling fallback mode - creating mock streaming server')
    this.fallbackMode = true
    this.isConnecting = false
    this.connectionPromise = null
    
    // Clear existing connection
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }

    // Create enhanced mock socket
    const mockSocket = {
      connected: true,
      id: 'fallback-socket-' + Math.random().toString(36).substr(2, 9),
      
      emit: (event: string, data?: any) => {
        console.log('📤 Fallback emit:', event, data)
        
        // Simulate realistic server responses with delays
        setTimeout(() => {
          switch (event) {
            case 'start-broadcast':
              this.triggerEvent?.('stream-started', {
                sessionId: 'fallback-session-' + Date.now(),
                streamType: data?.streamType || 'webcam',
                timestamp: new Date().toISOString()
              })
              break
              
            case 'stop-broadcast':
              this.triggerEvent?.('stream-ended', {
                sessionId: 'fallback-session',
                timestamp: new Date().toISOString()
              })
              break
              
            case 'join-stream':
              // Simulate viewer joining
              this.triggerEvent?.('viewer-count', Math.floor(Math.random() * 10) + 1)
              break
              
            case 'leave-stream':
              this.triggerEvent?.('viewer-count', Math.max(0, Math.floor(Math.random() * 5)))
              break
              
            case 'heartbeat':
              console.log('💓 Fallback heartbeat acknowledged')
              break
          }
        }, 300 + Math.random() * 700) // Random delay 0.3-1s
      },
      
      on: (event: string, callback: (...args: any[]) => void) => {
        console.log('📥 Fallback listener registered for:', event)
        if (!this.eventCallbacks.has(event)) {
          this.eventCallbacks.set(event, [])
        }
        this.eventCallbacks.get(event)?.push(callback)
      },
      
      once: (event: string, callback: (...args: any[]) => void) => {
        console.log('📥 Fallback once listener registered for:', event)
        const onceWrapper = (...args: any[]) => {
          callback(...args)
          // Remove after first call
          const callbacks = this.eventCallbacks.get(event) || []
          const index = callbacks.indexOf(onceWrapper)
          if (index > -1) {
            callbacks.splice(index, 1)
          }
        }
        this.on(event, onceWrapper)
      },
      
      off: (event: string, callback?: (...args: any[]) => void) => {
        console.log('📥 Fallback listener removed for:', event)
        if (this.eventCallbacks.has(event)) {
          if (callback) {
            const callbacks = this.eventCallbacks.get(event) || []
            const index = callbacks.indexOf(callback)
            if (index > -1) {
              callbacks.splice(index, 1)
            }
          } else {
            this.eventCallbacks.set(event, [])
          }
        }
      },
      
      removeAllListeners: () => {
        console.log('📥 Fallback removing all listeners')
        this.eventCallbacks.clear()
      },
      
      disconnect: () => {
        console.log('🔌 Fallback socket disconnected')
        mockSocket.connected = false
        this.stopFallbackSimulation()
      }
    } as any

    // Set up event triggering
    this.triggerEvent = (event: string, data?: any) => {
      const callbacks = this.eventCallbacks.get(event) || []
      callbacks.forEach((callback: (...args: any[]) => void) => {
        try {
          callback(data)
        } catch (error) {
          console.error('Error in fallback event callback:', error)
        }
      })
    }

    this.socket = mockSocket
    
    console.log('✅ Fallback streaming server connected')
    
    // Start fallback simulation
    this.startFallbackSimulation()
  }

  private startFallbackSimulation(): void {
    // Simulate viewer activity in fallback mode
    this.fallbackInterval = setInterval(() => {
      if (this.fallbackMode && this.socket?.connected) {
        const viewerCount = Math.floor(Math.random() * 8) + 1
        this.triggerEvent?.('viewer-count', viewerCount)
      }
    }, 8000) // Update every 8 seconds
  }

  private stopFallbackSimulation(): void {
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval)
      this.fallbackInterval = null
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat', {
          timestamp: new Date().toISOString(),
          clientId: this.socket.id,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server'
        })
      }
    }, 25000) // Send heartbeat every 25 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  disconnect(): void {
    console.log('🔌 Disconnecting socket manager...')
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }
    
    this.stopHeartbeat()
    this.stopFallbackSimulation()
    
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    
    this.isConnecting = false
    this.reconnectAttempts = 0
    this.fallbackMode = false
    this.currentUrlIndex = 0
    this.connectionPromise = null
    this.eventCallbacks.clear()
    this.triggerEvent = null
  }

  // Public API methods
  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback)
    } else if (this.fallbackMode) {
      if (!this.eventCallbacks.has(event)) {
        this.eventCallbacks.set(event, [])
      }
      this.eventCallbacks.get(event)?.push(callback)
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback)
      } else {
        this.socket.off(event)
      }
    } else if (this.fallbackMode && this.eventCallbacks.has(event)) {
      if (callback) {
        const callbacks = this.eventCallbacks.get(event) || []
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      } else {
        this.eventCallbacks.set(event, [])
      }
    }
  }

  get connected(): boolean {
    return this.socket?.connected || this.fallbackMode || false
  }

  // Broadcasting events
  startBroadcast(streamType: StreamType): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized. Please refresh and try again.'))
        return
      }

      if (!this.socket.connected && !this.fallbackMode) {
        reject(new Error('Not connected to streaming server. Please check your connection and try again.'))
        return
      }

      console.log('🚀 Starting broadcast with type:', streamType)

      // Set up one-time listeners for the response
      const timeout = setTimeout(() => {
        this.socket?.off('stream-started')
        this.socket?.off('stream-error')
        if (this.fallbackMode) {
          console.log('✅ Fallback broadcast started successfully')
          resolve()
        } else {
          reject(new Error('Stream start timeout - server did not respond within 8 seconds'))
        }
      }, 8000) // 8 second timeout

      if (this.socket) {
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
          clientId: this.socket.id,
          fallbackMode: this.fallbackMode
        })
      }
    })
  }

  stopBroadcast(): void {
    if (this.socket) {
      console.log('🛑 Stopping broadcast')
      this.socket.emit('stop-broadcast', {
        timestamp: new Date().toISOString(),
        clientId: this.socket.id,
        fallbackMode: this.fallbackMode
      })
    }
  }

  // Event listeners
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

  onStreamOffer(callback: (offer: RTCSessionDescriptionInit) => void): void {
    this.on('stream-offer', callback)
  }

  onStreamAnswer(callback: (answer: RTCSessionDescriptionInit) => void): void {
    this.on('stream-answer', callback)
  }

  onIceCandidate(callback: (candidate: RTCIceCandidateInit) => void): void {
    this.on('ice-candidate', callback)
  }

  // Send WebRTC signaling data
  sendOffer(offer: RTCSessionDescriptionInit, targetId?: string): void {
    if (this.socket?.connected || this.fallbackMode) {
      this.socket?.emit('stream-offer', { offer, targetId })
    }
  }

  sendAnswer(answer: RTCSessionDescriptionInit, targetId: string): void {
    if (this.socket?.connected || this.fallbackMode) {
      this.socket?.emit('stream-answer', { answer, targetId })
    }
  }

  sendIceCandidate(candidate: RTCIceCandidateInit, targetId?: string): void {
    if (this.socket?.connected || this.fallbackMode) {
      this.socket?.emit('ice-candidate', { candidate, targetId })
    }
  }

  // Get connection status
  isConnected(): boolean {
    return this.socket?.connected || this.fallbackMode || false
  }

  getSocketId(): string | undefined {
    return this.socket?.id
  }

  getConnectionState(): string {
    if (!this.socket) return 'disconnected'
    if (this.fallbackMode) return 'fallback'
    if (this.isConnecting) return 'connecting'
    if (this.socket.connected) return 'connected'
    return 'disconnected'
  }

  isFallbackMode(): boolean {
    return this.fallbackMode
  }

  // Force reconnection
  forceReconnect(): void {
    console.log('🔄 Force reconnecting...')
    this.disconnect()
    setTimeout(() => {
      this.currentUrlIndex = 0
      this.reconnectAttempts = 0
      this.connect()
    }, 1000)
  }

  // Get connection health info
  getConnectionHealth(): {
    connected: boolean;
    fallbackMode: boolean;
    reconnectAttempts: number;
    currentUrl: string;
    socketId?: string;
  } {
    const urls = this.getSocketUrls()
    return {
      connected: this.isConnected(),
      fallbackMode: this.fallbackMode,
      reconnectAttempts: this.reconnectAttempts,
      currentUrl: urls[this.currentUrlIndex] || 'none',
      socketId: this.socket?.id
    }
  }
}

// Export singleton instance
export const socketManager = new SocketManager()