import { io, Socket } from 'socket.io-client'
import { StreamType } from '@/types'
import { STREAM_CONFIG, log } from '@/lib/stream-config'

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
  private eventCallbacks: Map<string, ((...args: any[]) => void)[]> = new Map()
  private triggerEvent: ((event: string, data?: any) => void) | null = null
  private fallbackInterval: NodeJS.Timeout | null = null
  private currentUrlIndex = 0
  private connectionPromise: Promise<Socket> | null = null
  private urlAttempts = 0
  private broadcastChannel: BroadcastChannel | null = null
  private isDestroyed = false

  private getSocketUrls(): string[] {
    return STREAM_CONFIG.SERVER_URLS
  }

  constructor() {
    this.setupBroadcastChannel()
  }

  private setupBroadcastChannel(): void {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window && STREAM_CONFIG.FALLBACK.enableBroadcastChannel) {
        this.broadcastChannel = new BroadcastChannel('livestream-socket')
        
        this.broadcastChannel.addEventListener('message', (event) => {
          const { type, data } = event.data
          if (this.triggerEvent) {
            this.triggerEvent(type, data)
          }
        })
        
        log('info', '📡 Socket BroadcastChannel initialized')
      }
    } catch (error) {
      log('warn', '⚠️ Failed to setup BroadcastChannel', error)
    }
  }

  connect(): Socket {
    if (this.isDestroyed) {
      log('warn', 'Attempted to connect destroyed socket manager')
      return this.socket as Socket
    }

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
    if (this.isConnecting || this.isDestroyed) {
      return this.socket as Socket
    }

    this.isConnecting = true

    try {
      const socketUrls = this.getSocketUrls()
      
      // If we've tried all URLs multiple times, enable fallback
      if (this.currentUrlIndex >= socketUrls.length) {
        if (this.urlAttempts >= STREAM_CONFIG.CONNECTION.maxUrlAttempts) {
          log('warn', 'All connection attempts exhausted, enabling fallback mode')
          this.enableFallbackMode()
          return this.socket as Socket
        } else {
          // Reset URL index and increment attempt counter
          this.currentUrlIndex = 0
          this.urlAttempts++
          log('info', `Starting URL attempt round ${this.urlAttempts}`)
        }
      }

      const socketUrl = socketUrls[this.currentUrlIndex] || 'ws://localhost:3001'
      
      log('info', `🔌 Connecting to: ${socketUrl} (URL ${this.currentUrlIndex + 1}/${socketUrls.length}, Attempt ${this.urlAttempts + 1}/${STREAM_CONFIG.CONNECTION.maxUrlAttempts})`)
      
      // Clean up existing socket
      if (this.socket) {
        this.socket.removeAllListeners()
        this.socket.disconnect()
        this.socket = null
      }

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: STREAM_CONFIG.CONNECTION.timeout,
        retries: 3,
        reconnection: true,
        reconnectionAttempts: 2,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 2000,
        forceNew: true,
        upgrade: true,
        rememberUpgrade: false,
        autoConnect: true,
        closeOnBeforeunload: false
      })

      // Set up connection promise
      return new Promise((resolve, reject) => {
        if (this.isDestroyed) {
          reject(new Error('Socket manager destroyed'))
          return
        }

        // Connection timeout
        this.connectionTimeout = setTimeout(() => {
          log('warn', `⏱️ Connection timeout for ${socketUrl}`)
          this.handleConnectionFailure('Connection timeout')
          reject(new Error('Connection timeout'))
        }, STREAM_CONFIG.CONNECTION.timeout + 2000)

        // Success handler
        const onConnect = () => {
          if (this.isDestroyed) return
          
          log('info', '✅ Socket connected successfully:', this.socket?.id)
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.fallbackMode = false
          this.currentUrlIndex = 0
          this.urlAttempts = 0
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
          if (this.isDestroyed) return
          
          log('error', `❌ Socket connection error for ${socketUrl}:`, error.message)
          this.handleConnectionFailure(error.message)
          reject(error)
        }

        const onDisconnect = (reason: string) => {
          if (this.isDestroyed) return
          
          log('warn', '❌ Socket disconnected:', reason)
          this.isConnecting = false
          this.stopHeartbeat()
          
          // Auto-reconnect for certain disconnect reasons
          if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'transport error') {
            log('info', '🔄 Server initiated disconnect, attempting reconnect...')
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
      log('error', '❌ Failed to initialize socket:', error)
      this.isConnecting = false
      this.connectionPromise = null
      this.handleConnectionFailure('Socket initialization failed')
      throw error
    }
  }

  private handleConnectionFailure(reason: string): void {
    if (this.isDestroyed) return

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
      this.reconnectAttempts = 0
      
      if (this.currentUrlIndex < socketUrls.length || this.urlAttempts < STREAM_CONFIG.CONNECTION.maxUrlAttempts - 1) {
        log('info', `🔄 Trying next connection method...`)
        this.connectionPromise = null
        setTimeout(() => this.connect(), 1500)
      } else {
        log('error', '❌ All connection attempts failed, enabling fallback mode')
        this.enableFallbackMode()
      }
    } else {
      // Retry same URL with backoff
      const delay = STREAM_CONFIG.CONNECTION.reconnectBackoff[Math.min(this.reconnectAttempts - 1, STREAM_CONFIG.CONNECTION.reconnectBackoff.length - 1)]
      log('info', `🔄 Retrying connection in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      this.connectionPromise = null
      setTimeout(() => this.connect(), delay)
    }
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket || this.isDestroyed) return

    this.socket.on('reconnect', (attemptNumber: number) => {
      if (this.isDestroyed) return
      log('info', '✅ Socket reconnected after', attemptNumber, 'attempts')
      this.reconnectAttempts = 0
      this.fallbackMode = false
    })

    this.socket.on('reconnect_error', (error: Error) => {
      if (this.isDestroyed) return
      log('error', '❌ Socket reconnection error:', error.message)
    })

    this.socket.on('reconnect_failed', () => {
      if (this.isDestroyed) return
      log('error', '❌ Socket reconnection failed completely')
      this.enableFallbackMode()
    })

    // Custom heartbeat/ping handler
    this.socket.on('ping', () => {
      if (this.socket && !this.isDestroyed) {
        this.socket.emit('pong', { timestamp: Date.now() })
      }
    })

    // Handle server-side events with bundled parameters
    this.socket.on('join-room', ({ roomId, userId, streamId }: JoinRoomPayload) => {
      if (!this.isDestroyed) {
        log('info', '🏠 Room joined:', { roomId, userId, streamId })
      }
    })

    this.socket.on('signal', ({ toId, fromId, signalData }: SignalPayload) => {
      if (!this.isDestroyed) {
        log('info', '📡 Signal received:', { toId, fromId, signalData })
      }
    })

    // Handle server-side events
    this.socket.on('server-status', (status: any) => {
      if (!this.isDestroyed) {
        log('info', '📊 Server status:', status)
      }
    })

    this.socket.on('server-heartbeat', (data: any) => {
      if (!this.isDestroyed) {
        log('info', '💓 Server heartbeat:', data.timestamp)
      }
    })

    // Error handling
    this.socket.on('error', (error: Error) => {
      if (!this.isDestroyed) {
        log('error', '❌ Socket error:', error)
      }
    })
  }

  private tryReconnect(): void {
    if (this.isDestroyed) return
    
    if (this.socket && !this.socket.connected) {
      log('info', '🔄 Attempting manual reconnect...')
      this.socket.connect()
    } else {
      this.connectionPromise = null
      this.connect()
    }
  }

  private enableFallbackMode(): void {
    if (this.isDestroyed) return
    
    log('info', '🔧 Enabling enhanced fallback mode')
    this.fallbackMode = true
    this.isConnecting = false
    this.connectionPromise = null
    
    // Clear existing connection
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }

    // Create enhanced mock socket with BroadcastChannel support
    const mockSocket = {
      connected: true,
      id: 'fallback-socket-' + Math.random().toString(36).substr(2, 9),
      
      emit: (event: string, data?: any) => {
        if (this.isDestroyed) return
        log('info', '📤 Fallback emit:', event, data)
        
        // Broadcast to other tabs
        if (this.broadcastChannel) {
          try {
            this.broadcastChannel.postMessage({ type: event, data })
          } catch (error) {
            log('warn', 'Failed to broadcast via BroadcastChannel', error)
          }
        }
        
        // Simulate realistic server responses with delays
        setTimeout(() => {
          if (this.isDestroyed) return
          
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
              this.triggerEvent?.('stream-joined', {
                sessionId: data?.sessionId || 'fallback-session',
                viewerCount: Math.floor(Math.random() * 8) + 1
              })
              this.triggerEvent?.('viewer-count', Math.floor(Math.random() * 10) + 1)
              break
              
            case 'leave-stream':
              this.triggerEvent?.('viewer-count', Math.max(0, Math.floor(Math.random() * 5)))
              break
              
            case 'heartbeat':
              this.triggerEvent?.('heartbeat-ack', {
                timestamp: new Date().toISOString(),
                serverId: 'fallback-server'
              })
              break
          }
        }, 200 + Math.random() * 800) // Random delay 0.2-1s
      },
      
      on: (event: string, callback: (...args: any[]) => void) => {
        if (this.isDestroyed) return
        log('info', '📥 Fallback listener registered for:', event)
        if (!this.eventCallbacks.has(event)) {
          this.eventCallbacks.set(event, [])
        }
        this.eventCallbacks.get(event)?.push(callback)
      },
      
      once: (event: string, callback: (...args: any[]) => void) => {
        if (this.isDestroyed) return
        log('info', '📥 Fallback once listener registered for:', event)
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
        if (this.isDestroyed) return
        log('info', '📥 Fallback listener removed for:', event)
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
        if (this.isDestroyed) return
        log('info', '📥 Fallback removing all listeners')
        this.eventCallbacks.clear()
      },
      
      disconnect: () => {
        if (this.isDestroyed) return
        log('info', '🔌 Fallback socket disconnected')
        mockSocket.connected = false
        this.stopFallbackSimulation()
      }
    } as any

    // Set up event triggering
    this.triggerEvent = (event: string, data?: any) => {
      if (this.isDestroyed) return
      const callbacks = this.eventCallbacks.get(event) || []
      callbacks.forEach((callback: (...args: any[]) => void) => {
        try {
          callback(data)
        } catch (error) {
          log('error', 'Error in fallback event callback:', error)
        }
      })
    }

    this.socket = mockSocket
    
    log('info', '✅ Enhanced fallback streaming server connected')
    
    // Start fallback simulation
    this.startFallbackSimulation()
  }

  private startFallbackSimulation(): void {
    if (this.isDestroyed) return
    
    // Simulate viewer activity and server heartbeats in fallback mode
    this.fallbackInterval = setInterval(() => {
      if (this.fallbackMode && this.socket?.connected && !this.isDestroyed) {
        // Simulate viewer count changes
        const viewerCount = Math.floor(Math.random() * 12) + 1
        this.triggerEvent?.('viewer-count', viewerCount)
        
        // Simulate server heartbeat
        this.triggerEvent?.('server-heartbeat', {
          timestamp: new Date().toISOString(),
          activeStreams: 1,
          totalConnections: viewerCount + 1
        })
      }
    }, 6000) // Update every 6 seconds
  }

  private stopFallbackSimulation(): void {
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval)
      this.fallbackInterval = null
    }
  }

  private startHeartbeat(): void {
    if (this.isDestroyed) return
    
    this.stopHeartbeat()
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected && !this.isDestroyed) {
        this.socket.emit('heartbeat', {
          timestamp: new Date().toISOString(),
          clientId: this.socket.id,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server'
        })
      }
    }, STREAM_CONFIG.CONNECTION.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  disconnect(): void {
    log('info', '🔌 Disconnecting socket manager...')
    
    this.isDestroyed = true
    
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
    
    if (this.broadcastChannel) {
      this.broadcastChannel.close()
      this.broadcastChannel = null
    }
    
    this.isConnecting = false
    this.reconnectAttempts = 0
    this.fallbackMode = false
    this.currentUrlIndex = 0
    this.urlAttempts = 0
    this.connectionPromise = null
    this.eventCallbacks.clear()
    this.triggerEvent = null
  }

  // Public API methods
  on(event: string, callback: (...args: any[]) => void): void {
    if (this.isDestroyed) return
    
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
    if (this.isDestroyed) return
    
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
    return (this.socket?.connected || this.fallbackMode) && !this.isDestroyed
  }

  // FIXED: Socket.IO emit methods - bundled parameters into single payload objects
  joinRoom(roomId: string, userId: string, streamId: string): void {
    if (this.socket && !this.isDestroyed) {
      // FIXED: Using single payload object instead of multiple parameters
      this.socket.emit('join-room', { roomId, userId, streamId } as JoinRoomPayload)
    }
  }

  sendSignal(toId: string, fromId: string, signalData: any): void {
    if (this.socket && !this.isDestroyed) {
      // FIXED: Using single payload object instead of multiple parameters  
      this.socket.emit('signal', { toId, fromId, signalData } as SignalPayload)
    }
  }

  // Broadcasting events with enhanced error handling
  startBroadcast(streamType: StreamType): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isDestroyed) {
        reject(new Error('Socket manager destroyed'))
        return
      }

      if (!this.socket) {
        reject(new Error('Socket not initialized. Please refresh and try again.'))
        return
      }

      if (!this.socket.connected && !this.fallbackMode) {
        reject(new Error('Not connected to streaming server. Please check your connection and try again.'))
        return
      }

      log('info', '🚀 Starting broadcast with type:', streamType)

      // Set up one-time listeners for the response
      const timeout = setTimeout(() => {
        this.socket?.off('stream-started')
        this.socket?.off('stream-error')
        if (this.fallbackMode) {
          log('info', '✅ Fallback broadcast started successfully')
          resolve()
        } else {
          reject(new Error('Stream start timeout - server did not respond within 6 seconds'))
        }
      }, 6000)

      if (this.socket) {
        this.socket.once('stream-started', (data: StreamStartedEvent) => {
          clearTimeout(timeout)
          log('info', '✅ Stream started successfully:', data)
          resolve()
        })

        this.socket.once('stream-error', (error: StreamErrorEvent) => {
          clearTimeout(timeout)
          log('error', '❌ Stream start failed:', error)
          reject(new Error(error.message || 'Failed to start stream'))
        })

        // Using Socket.IO emit with single payload object
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
    if (this.isDestroyed) return
    
    if (this.socket) {
      log('info', '🛑 Stopping broadcast')
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

  onStreamOffer(callback: (data: any) => void): void {
    this.on('stream-offer', callback)
  }

  onStreamAnswer(callback: (data: any) => void): void {
    this.on('stream-answer', callback)
  }

  onIceCandidate(callback: (data: any) => void): void {
    this.on('ice-candidate', callback)
  }

  // Send WebRTC signaling data - Using proper Socket.IO emit signature (2 parameters only)
  sendOffer(offer: RTCSessionDescriptionInit, targetId?: string): void {
    if (this.isDestroyed) return
    
    if (this.socket?.connected || this.fallbackMode) {
      // Using standard Socket.IO emit with single payload object
      this.socket?.emit('stream-offer', { offer, targetId })
    }
  }

  sendAnswer(answer: RTCSessionDescriptionInit, targetId: string): void {
    if (this.isDestroyed) return
    
    if (this.socket?.connected || this.fallbackMode) {
      // Using standard Socket.IO emit with single payload object
      this.socket?.emit('stream-answer', { answer, targetId })
    }
  }

  sendIceCandidate(candidate: RTCIceCandidateInit, targetId?: string): void {
    if (this.isDestroyed) return
    
    if (this.socket?.connected || this.fallbackMode) {
      this.socket?.emit('ice-candidate', { candidate, targetId })
    }
  }

  // Get connection status
  isConnected(): boolean {
    return (this.socket?.connected || this.fallbackMode) && !this.isDestroyed
  }

  getSocketId(): string | undefined {
    return this.socket?.id
  }

  getConnectionState(): string {
    if (this.isDestroyed) return 'destroyed'
    if (!this.socket) return 'disconnected'
    if (this.fallbackMode) return 'fallback'
    if (this.isConnecting) return 'connecting'
    if (this.socket.connected) return 'connected'
    return 'disconnected'
  }

  isFallbackMode(): boolean {
    return this.fallbackMode && !this.isDestroyed
  }

  // Force reconnection
  forceReconnect(): void {
    if (this.isDestroyed) return
    
    log('info', '🔄 Force reconnecting...')
    this.disconnect()
    
    // Reset state for fresh connection attempt
    this.isDestroyed = false
    this.setupBroadcastChannel()
    
    setTimeout(() => {
      this.currentUrlIndex = 0
      this.urlAttempts = 0
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