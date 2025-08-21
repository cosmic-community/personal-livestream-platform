import { io, Socket } from 'socket.io-client'
import { getStreamConfig, createStreamError, testAllConnectionMethods } from '@/lib/stream-config'

export interface ConnectionConfig {
  timeout: number
  maxRetries: number
  maxUrlAttempts: number
  reconnectBackoff: number[]
  transports: string[]
  autoConnect: boolean
  forceNew: boolean
  healthCheckInterval: number
}

export interface ConnectionState {
  isConnected: boolean
  currentUrl: string | null
  connectionAttempt: number
  lastError: string | null
  fallbackMode: boolean
  healthCheckActive: boolean
}

export interface ConnectionHealth {
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  latency: number
  isConnected: boolean
  fallbackMode: boolean
  lastChecked: string
}

export interface NetworkStats {
  online: boolean
  downloadSpeed: number
  connectionType: string
  latency: number
}

export class ConnectionManager {
  private socket: Socket | null = null
  private config: ConnectionConfig
  private state: ConnectionState
  private serverUrls: string[]
  private currentUrlIndex = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private healthCheckTimer: NodeJS.Timeout | null = null
  private listeners: Map<string, Function[]> = new Map()

  constructor() {
    const streamConfig = getStreamConfig()
    this.serverUrls = streamConfig.SERVER_URLS
    this.config = streamConfig.CONNECTION
    this.state = {
      isConnected: false,
      currentUrl: null,
      connectionAttempt: 0,
      lastError: null,
      fallbackMode: false,
      healthCheckActive: false
    }
  }

  private log(message: string, data?: any): void {
    console.log(`[ConnectionManager] ${message}`, data || '')
  }

  private emitEvent(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event) || []
    eventListeners.forEach(listener => {
      try {
        listener(data)
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error)
      }
    })
  }

  async connect(): Promise<Socket | null> {
    if (this.socket?.connected) {
      return this.socket
    }

    this.log('Starting connection process...')
    this.state.connectionAttempt = 0
    this.state.lastError = null

    // Test connection methods first
    const connectionTests = await testAllConnectionMethods()
    this.log('Connection tests:', connectionTests)

    for (let urlAttempt = 0; urlAttempt < this.config.maxUrlAttempts; urlAttempt++) {
      const url = this.serverUrls[this.currentUrlIndex]
      this.log(`Attempting connection to ${url} (attempt ${urlAttempt + 1})`)

      const success = await this.attemptConnection(url)
      if (success) {
        this.startHealthCheck()
        return this.socket
      }

      // Try next URL
      this.currentUrlIndex = (this.currentUrlIndex + 1) % this.serverUrls.length
    }

    // All connection attempts failed
    this.log('All connection attempts failed, enabling fallback mode')
    this.enableFallbackMode()
    return null
  }

  private async attemptConnection(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.socket = io(url, {
          timeout: this.config.timeout,
          transports: this.config.transports,
          autoConnect: this.config.autoConnect,
          forceNew: this.config.forceNew,
          reconnection: false // We handle reconnection manually
        })

        const connectionTimeout = setTimeout(() => {
          this.log('Connection timeout')
          this.cleanup()
          resolve(false)
        }, this.config.timeout)

        this.socket.on('connect', () => {
          clearTimeout(connectionTimeout)
          this.log(`Connected successfully to ${url}`)
          
          this.state.isConnected = true
          this.state.currentUrl = url
          this.state.fallbackMode = false
          this.state.lastError = null

          this.setupSocketEventHandlers()
          this.emitEvent('connected', { url })
          resolve(true)
        })

        this.socket.on('connect_error', (error) => {
          clearTimeout(connectionTimeout)
          this.log('Connection error:', error.message)
          this.state.lastError = error.message
          this.cleanup()
          resolve(false)
        })

        this.socket.on('disconnect', (reason) => {
          this.log('Disconnected:', reason)
          this.handleDisconnection(reason)
        })

      } catch (error) {
        this.log('Error creating socket:', error)
        resolve(false)
      }
    })
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return

    // Relay all socket events to our event system
    this.socket.onAny((event, ...args) => {
      this.emitEvent(event, args.length === 1 ? args[0] : args)
    })

    // Handle specific events
    this.socket.on('stream-started', (data) => {
      this.emitEvent('stream-started', data)
    })

    this.socket.on('stream-ended', (data) => {
      this.emitEvent('stream-ended', data)
    })

    this.socket.on('viewer-count', (count) => {
      this.emitEvent('viewer-count', count)
    })

    this.socket.on('error', (error) => {
      this.log('Socket error:', error)
      this.emitEvent('socket-error', error)
    })
  }

  private handleDisconnection(reason: string): void {
    this.state.isConnected = false
    this.state.currentUrl = null
    this.stopHealthCheck()
    
    this.emitEvent('disconnected', { reason })

    // Attempt reconnection unless it was manual
    if (reason !== 'client disconnect') {
      this.scheduleReconnection()
    }
  }

  private scheduleReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    const backoffIndex = Math.min(
      this.state.connectionAttempt, 
      this.config.reconnectBackoff.length - 1
    )
    const delay = this.config.reconnectBackoff[backoffIndex] || 5000

    this.log(`Scheduling reconnection in ${delay}ms`)
    
    this.reconnectTimer = setTimeout(() => {
      this.state.connectionAttempt++
      if (this.state.connectionAttempt <= this.config.maxRetries) {
        this.log('Attempting reconnection...')
        this.connect()
      } else {
        this.log('Max reconnection attempts reached')
        this.enableFallbackMode()
      }
    }, delay)
  }

  private startHealthCheck(): void {
    if (this.healthCheckTimer || !this.config.healthCheckInterval) {
      return
    }

    this.state.healthCheckActive = true
    this.healthCheckTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping', Date.now())
      } else {
        this.log('Health check failed - not connected')
        this.handleDisconnection('health check failed')
      }
    }, this.config.healthCheckInterval)

    this.log('Health check started')
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
      this.state.healthCheckActive = false
      this.log('Health check stopped')
    }
  }

  private enableFallbackMode(): void {
    this.log('Enabling fallback mode')
    this.state.fallbackMode = true
    this.emitEvent('fallback-mode-enabled')
  }

  private cleanup(): void {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
  }

  // Public methods
  disconnect(): void {
    this.log('Manual disconnect')
    this.stopHealthCheck()
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.cleanup()
    this.state.isConnected = false
    this.state.currentUrl = null
  }

  forceReconnect(): void {
    this.log('Force reconnect requested')
    this.disconnect()
    setTimeout(() => {
      this.state.connectionAttempt = 0
      this.connect()
    }, 1000)
  }

  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else if (this.state.fallbackMode) {
      this.log(`Fallback mode: ignoring emit ${event}`)
    } else {
      this.log(`Cannot emit ${event}: not connected`)
    }
  }

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  off(event: string, listener?: Function): void {
    if (!this.listeners.has(event)) return

    if (listener) {
      const eventListeners = this.listeners.get(event)!
      const index = eventListeners.indexOf(listener)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    } else {
      this.listeners.delete(event)
    }
  }

  // Additional methods needed by useConnection hook
  getConnectionHealth(): ConnectionHealth {
    return {
      quality: this.state.isConnected ? 'good' : 'poor',
      latency: 0, // TODO: implement latency measurement
      isConnected: this.state.isConnected,
      fallbackMode: this.state.fallbackMode,
      lastChecked: new Date().toISOString()
    }
  }

  getNetworkStats(): NetworkStats {
    return {
      online: navigator.onLine,
      downloadSpeed: 0, // TODO: implement speed test
      connectionType: 'unknown',
      latency: 0
    }
  }

  getConnectionRecommendations(): string[] {
    const recommendations: string[] = []
    if (!this.state.isConnected) {
      recommendations.push('Check your internet connection')
    }
    if (this.state.fallbackMode) {
      recommendations.push('Consider refreshing the page to retry connection')
    }
    return recommendations
  }

  async forceHealthCheck(): Promise<void> {
    // Force a health check
    if (this.socket?.connected) {
      this.socket.emit('ping', Date.now())
    }
  }

  isMethodAvailable(method: string): boolean {
    // Check if a connection method is available
    switch (method) {
      case 'websocket':
        return typeof WebSocket !== 'undefined'
      case 'webrtc':
        return typeof RTCPeerConnection !== 'undefined'
      default:
        return false
    }
  }

  getBestConnectionMethod(): string {
    if (this.isMethodAvailable('websocket')) return 'websocket'
    if (this.isMethodAvailable('webrtc')) return 'webrtc'
    return 'fallback'
  }

  broadcastMessage(type: string, data: any): void {
    // Broadcast message to other tabs via BroadcastChannel if available
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('livestream-connection')
        channel.postMessage({ type, data })
        channel.close()
      } catch (error) {
        console.warn('Failed to broadcast message:', error)
      }
    }
  }

  // Getters
  isConnected(): boolean {
    return this.state.isConnected
  }

  isFallbackMode(): boolean {
    return this.state.fallbackMode
  }

  getConnectionState(): ConnectionState {
    return { ...this.state }
  }

  getCurrentUrl(): string | null {
    return this.state.currentUrl
  }

  getSocket(): Socket | null {
    return this.socket
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager()

export default ConnectionManager