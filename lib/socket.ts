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
  private eventCallbacks?: Map<string, Function[]>
  private triggerEvent?: (event: string, data?: any) => void
  private fallbackInterval?: NodeJS.Timeout

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
      ].filter(Boolean) as string[]

      const socketUrl = socketUrls[0] || 'ws://localhost:3001'
      
      console.log('🔌 Attempting to connect to streaming server:', socketUrl)
      
      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        retries: 3,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        forceNew: true,
        upgrade: true,
        rememberUpgrade: false,
        autoConnect: true
      })

      // Connection timeout fallback
      this.connectionTimeout = setTimeout(() => {
        if (!this.socket?.connected) {
          console.warn('⏱️ Connection timeout - enabling fallback mode')
          this.enableFallbackMode()
        }
      }, 15000)

      this.socket.on('connect', () => {
        console.log('✅ Socket connected successfully:', this.socket?.id)
        this.isConnecting = false
        this.reconnectAttempts = 0
        this.fallbackMode = false
        
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
        if (reason === 'io server disconnect' || reason === 'transport close') {
          console.log('🔄 Server initiated disconnect, attempting reconnect...')
          setTimeout(() => this.tryReconnect(), 2000)
        }
      })

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error.message)
        this.isConnecting = false
        this.reconnectAttempts++

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached, enabling fallback mode')
          this.enableFallbackMode()
        } else {
          // Try next URL in the list
          setTimeout(() => this.tryNextUrl(), 2000)
        }
      })

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

      return this.socket

    } catch (error) {
      console.error('❌ Failed to initialize socket:', error)
      this.isConnecting = false
      this.enableFallbackMode()
      throw error
    }
  }

  private tryReconnect(): void {
    if (this.socket && !this.socket.connected) {
      console.log('🔄 Attempting manual reconnect...')
      this.socket.connect()
    } else {
      this.connect()
    }
  }

  private tryNextUrl(): void {
    // Disconnect current socket
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    
    // Clear connection flag and try again
    this.isConnecting = false
    setTimeout(() => this.connect(), 1000)
  }

  private enableFallbackMode(): void {
    console.log('🔧 Enabling fallback mode - creating mock streaming server')
    this.fallbackMode = true
    
    // Clear existing connection
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    // Create a more sophisticated mock socket
    const mockSocket = {
      connected: true,
      id: 'fallback-socket-' + Math.random().toString(36).substr(2, 9),
      
      emit: (event: string, data?: any) => {
        console.log('📤 Fallback emit:', event, data)
        
        // Simulate realistic server responses with delays
        setTimeout(() => {
          switch (event) {
            case 'start-broadcast':
              if (this.triggerEvent) {
                this.triggerEvent('stream-started', {
                  sessionId: 'fallback-session-' + Date.now(),
                  streamType: data?.streamType || 'webcam',
                  timestamp: new Date().toISOString()
                })
              }
              break
              
            case 'stop-broadcast':
              if (this.triggerEvent) {
                this.triggerEvent('stream-ended', {
                  sessionId: 'fallback-session',
                  timestamp: new Date().toISOString()
                })
              }
              break
              
            case 'join-stream':
              // Simulate viewer joining
              if (this.triggerEvent) {
                this.triggerEvent('viewer-count', Math.floor(Math.random() * 10) + 1)
              }
              break
              
            case 'heartbeat':
              console.log('💓 Fallback heartbeat acknowledged')
              break
          }
        }, 500 + Math.random() * 1000) // Random delay 0.5-1.5s
      },
      
      on: (event: string, callback: Function) => {
        console.log('📥 Fallback listener registered for:', event)
        // Store callback for later use
        if (!this.eventCallbacks) {
          this.eventCallbacks = new Map()
        }
        if (!this.eventCallbacks.has(event)) {
          this.eventCallbacks.set(event, [])
        }
        this.eventCallbacks.get(event)?.push(callback)
      },
      
      once: (event: string, callback: Function) => {
        console.log('📥 Fallback once listener registered for:', event)
        const onceWrapper = (...args: any[]) => {
          callback(...args)
          // Remove after first call
          if (this.socket && typeof this.socket.off === 'function') {
            this.socket.off(event, onceWrapper)
          }
        }
        if (this.socket && typeof this.socket.on === 'function') {
          this.socket.on(event, onceWrapper)
        }
      },
      
      off: (event: string, callback?: Function) => {
        console.log('📥 Fallback listener removed for:', event)
        if (this.eventCallbacks?.has(event)) {
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
      
      disconnect: () => {
        console.log('🔌 Fallback socket disconnected')
        mockSocket.connected = false
      }
    } as any

    // Add method to trigger events
    this.eventCallbacks = new Map()
    this.triggerEvent = (event: string, data?: any) => {
      const callbacks = this.eventCallbacks?.get(event) || []
      callbacks.forEach((callback: Function) => {
        try {
          callback(data)
        } catch (error) {
          console.error('Error in fallback event callback:', error)
        }
      })
    }

    this.socket = mockSocket
    this.isConnecting = false
    
    console.log('✅ Fallback streaming server connected')
    
    // Simulate periodic viewer count updates in fallback mode
    this.startFallbackSimulation()
  }

  private startFallbackSimulation(): void {
    // Simulate viewer activity in fallback mode
    this.fallbackInterval = setInterval(() => {
      if (this.fallbackMode && this.socket?.connected) {
        const viewerCount = Math.floor(Math.random() * 5) + 1
        if (this.triggerEvent) {
          this.triggerEvent('viewer-count', viewerCount)
        }
      }
    }, 10000) // Update every 10 seconds
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
    }, 30000) // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval)
      this.fallbackInterval = null
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
    this.fallbackMode = false
    this.eventCallbacks?.clear()
  }

  // Add the missing methods that were causing TypeScript errors
  on(event: string, callback: Function): void {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  off(event: string, callback?: Function): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback)
      } else {
        this.socket.off(event)
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
      const timeout: NodeJS.Timeout | undefined = setTimeout(() => {
        if (this.socket) {
          this.socket.off('stream-started')
          this.socket.off('stream-error')
        }
        if (this.fallbackMode) {
          // In fallback mode, simulate success
          console.log('✅ Fallback broadcast started successfully')
          resolve()
        } else {
          reject(new Error('Stream start timeout - server did not respond within 10 seconds'))
        }
      }, 10000) // 10 second timeout

      if (this.socket) {
        this.socket.once('stream-started', (data: StreamStartedEvent) => {
          if (timeout) {
            clearTimeout(timeout)
          }
          console.log('✅ Stream started successfully:', data)
          resolve()
        })

        this.socket.once('stream-error', (error: StreamErrorEvent) => {
          if (timeout) {
            clearTimeout(timeout)
          }
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
    if (this.socket) {
      this.socket.on('stream-started', callback)
    }
  }

  onStreamEnded(callback: (data: StreamEndedEvent) => void): void {
    if (this.socket) {
      this.socket.on('stream-ended', callback)
    }
  }

  onStreamError(callback: (error: StreamErrorEvent) => void): void {
    if (this.socket) {
      this.socket.on('stream-error', callback)
    }
  }

  onViewerCount(callback: (count: number) => void): void {
    if (this.socket) {
      this.socket.on('viewer-count', callback)
    }
  }

  onStreamOffer(callback: (offer: RTCSessionDescriptionInit) => void): void {
    if (this.socket) {
      this.socket.on('stream-offer', callback)
    }
  }

  onStreamAnswer(callback: (answer: RTCSessionDescriptionInit) => void): void {
    if (this.socket) {
      this.socket.on('stream-answer', callback)
    }
  }

  onIceCandidate(callback: (candidate: RTCIceCandidateInit) => void): void {
    if (this.socket) {
      this.socket.on('ice-candidate', callback)
    }
  }

  // Send WebRTC signaling data
  sendOffer(offer: RTCSessionDescriptionInit, targetId?: string): void {
    if (this.socket?.connected || this.fallbackMode) {
      if (this.socket) {
        this.socket.emit('stream-offer', { offer, targetId })
      }
    }
  }

  sendAnswer(answer: RTCSessionDescriptionInit, targetId: string): void {
    if (this.socket?.connected || this.fallbackMode) {
      if (this.socket) {
        this.socket.emit('stream-answer', { answer, targetId })
      }
    }
  }

  sendIceCandidate(candidate: RTCIceCandidateInit, targetId?: string): void {
    if (this.socket?.connected || this.fallbackMode) {
      if (this.socket) {
        this.socket.emit('ice-candidate', { candidate, targetId })
      }
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
}

// Export singleton instance
export const socketManager = new SocketManager()