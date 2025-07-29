import { socketManager } from '@/lib/socket'
import { STREAM_CONFIG, log, createStreamError, testAllConnectionMethods } from '@/lib/stream-config'

export interface ConnectionHealth {
  status: 'connected' | 'connecting' | 'disconnected' | 'fallback' | 'p2p'
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  latency: number
  retryCount: number
  lastConnected?: string
  serverUrl?: string
  fallbackMode: boolean
  connectionMethod: 'websocket' | 'broadcastchannel' | 'localstorage' | 'webrtc-direct'
}

export interface NetworkStats {
  online: boolean
  latency: number
  downloadSpeed?: number
  uploadSpeed?: number
  connectionType?: string
  canReachServers: boolean
  availableMethods: string[]
}

class ConnectionManager {
  private healthCheckInterval: NodeJS.Timeout | null = null
  private networkTestInterval: NodeJS.Timeout | null = null
  private connectionHealth: ConnectionHealth = {
    status: 'disconnected',
    quality: 'poor',
    latency: 0,
    retryCount: 0,
    fallbackMode: false,
    connectionMethod: 'websocket'
  }
  private networkStats: NetworkStats = {
    online: navigator.onLine,
    latency: 0,
    canReachServers: false,
    availableMethods: []
  }
  private listeners: Map<string, Function[]> = new Map()
  private broadcastChannel: BroadcastChannel | null = null
  private connectionMethods: any = null

  constructor() {
    this.initializeHealthMonitoring()
    this.setupNetworkMonitoring()
    this.setupBroadcastChannel()
  }

  // Initialize connection health monitoring
  private initializeHealthMonitoring(): void {
    log('info', '🔍 Initializing enhanced connection health monitoring')

    this.healthCheckInterval = setInterval(() => {
      this.checkConnectionHealth()
    }, STREAM_CONFIG.CONNECTION.healthCheckInterval)

    // Initial health check with delay
    setTimeout(() => this.checkConnectionHealth(), 2000)
  }

  // Setup network monitoring
  private setupNetworkMonitoring(): void {
    log('info', '🌐 Setting up network monitoring')

    // Monitor online/offline status
    window.addEventListener('online', () => {
      log('info', '🌐 Network came online')
      this.networkStats.online = true
      this.emit('network-status-changed', this.networkStats)
      this.checkConnectionHealth()
    })

    window.addEventListener('offline', () => {
      log('warn', '🌐 Network went offline')
      this.networkStats.online = false
      this.emit('network-status-changed', this.networkStats)
    })

    // Periodic network tests
    this.networkTestInterval = setInterval(() => {
      this.testNetworkPerformance()
    }, 45000) // Every 45 seconds

    // Initial network test
    setTimeout(() => this.testNetworkPerformance(), 3000)
  }

  // Setup BroadcastChannel for cross-tab communication
  private setupBroadcastChannel(): void {
    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('livestream-sync')
        
        this.broadcastChannel.addEventListener('message', (event) => {
          const { type, data } = event.data
          
          switch (type) {
            case 'stream-started':
              this.emit('cross-tab-stream-started', data)
              break
            case 'stream-ended':
              this.emit('cross-tab-stream-ended', data)
              break
            case 'viewer-count':
              this.emit('cross-tab-viewer-count', data)
              break
          }
        })
        
        log('info', '📡 BroadcastChannel initialized for cross-tab sync')
      }
    } catch (error) {
      log('warn', '⚠️ Failed to initialize BroadcastChannel', error)
    }
  }

  // Check overall connection health with multiple methods
  private async checkConnectionHealth(): Promise<void> {
    try {
      const socketHealth = socketManager.getConnectionHealth()
      const isConnected = socketManager.isConnected()
      const isFallback = socketManager.isFallbackMode()

      // Test connection methods if not done yet
      if (!this.connectionMethods) {
        this.connectionMethods = await testAllConnectionMethods()
        this.networkStats.availableMethods = Object.entries(this.connectionMethods)
          .filter(([, available]) => available)
          .map(([method]) => method)
      }

      // Determine connection method
      let connectionMethod: ConnectionHealth['connectionMethod'] = 'websocket'
      if (isFallback) {
        if (this.connectionMethods?.broadcastChannel) {
          connectionMethod = 'broadcastchannel'
        } else if (this.connectionMethods?.localStorage) {
          connectionMethod = 'localstorage'
        } else if (this.connectionMethods?.webrtc) {
          connectionMethod = 'webrtc-direct'
        }
      }

      // Test server connectivity
      let serverLatency = 0
      if (isConnected && !isFallback) {
        serverLatency = await this.pingServer()
      }

      const previousStatus = this.connectionHealth.status

      this.connectionHealth = {
        status: isConnected ? (isFallback ? 'fallback' : 'connected') : 
               socketHealth.reconnectAttempts > 0 ? 'connecting' : 'disconnected',
        quality: this.assessOverallQuality(serverLatency, this.networkStats),
        latency: serverLatency,
        retryCount: socketHealth.reconnectAttempts,
        lastConnected: isConnected ? new Date().toISOString() : this.connectionHealth.lastConnected,
        serverUrl: socketHealth.currentUrl,
        fallbackMode: isFallback,
        connectionMethod
      }

      // Emit status change if different
      if (previousStatus !== this.connectionHealth.status) {
        log('info', `🔄 Connection status changed: ${previousStatus} → ${this.connectionHealth.status}`)
        this.emit('connection-status-changed', this.connectionHealth)
      }

      // Emit regular health updates
      this.emit('health-update', this.connectionHealth)

      // Broadcast connection status to other tabs
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'connection-status',
          data: this.connectionHealth
        })
      }

    } catch (error) {
      log('error', '❌ Error checking connection health', error)
    }
  }

  // Test network performance with enhanced metrics
  private async testNetworkPerformance(): Promise<void> {
    try {
      const testResults = await Promise.allSettled([
        this.testLatency(),
        this.testDownloadSpeed(),
        this.testServerReachability(),
        this.testWebRTCConnectivity()
      ])

      const [latencyResult, speedResult, reachabilityResult, webrtcResult] = testResults

      this.networkStats = {
        online: navigator.onLine,
        latency: latencyResult.status === 'fulfilled' ? latencyResult.value : 5000,
        downloadSpeed: speedResult.status === 'fulfilled' ? speedResult.value : undefined,
        connectionType: this.getConnectionType(),
        canReachServers: reachabilityResult.status === 'fulfilled' ? reachabilityResult.value : false,
        availableMethods: this.networkStats.availableMethods || []
      }

      log('info', '📊 Enhanced network performance test completed', this.networkStats)
      this.emit('network-performance-update', this.networkStats)

    } catch (error) {
      log('error', '❌ Error testing network performance', error)
    }
  }

  // Test latency to multiple endpoints with timeout
  private async testLatency(): Promise<number> {
    const testUrls = [
      'https://www.google.com/favicon.ico',
      'https://www.cloudflare.com/favicon.ico',
      'https://cdn.jsdelivr.net/npm/react@18.0.0/package.json',
      'https://httpbin.org/status/200'
    ]

    const latencyPromises = testUrls.map(async (url) => {
      const start = performance.now()
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000)
        
        await fetch(url, { 
          mode: 'no-cors',
          cache: 'no-cache',
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        return performance.now() - start
      } catch {
        return 5000 // High penalty for failed requests
      }
    })

    const latencies = await Promise.allSettled(latencyPromises)
    const successfulLatencies = latencies
      .filter((result): result is PromiseFulfilledResult<number> => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(latency => latency < 5000)

    return successfulLatencies.length > 0 ? Math.min(...successfulLatencies) : 5000
  }

  // Test download speed with better error handling
  private async testDownloadSpeed(): Promise<number> {
    try {
      const testUrl = 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'
      const start = performance.now()
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)
      
      const response = await fetch(testUrl, {
        cache: 'no-cache',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      const data = await response.arrayBuffer()
      const duration = (performance.now() - start) / 1000 // Convert to seconds
      
      return (data.byteLength * 8) / duration / 1000 // Convert to Kbps
    } catch {
      return 0
    }
  }

  // Test if streaming servers are reachable
  private async testServerReachability(): Promise<boolean> {
    const serverUrls = STREAM_CONFIG.SERVER_URLS

    for (const url of serverUrls) {
      try {
        // Try to connect to each server
        const wsUrl = url.replace('http://', 'ws://').replace('https://', 'wss://')
        const testSocket = new WebSocket(wsUrl)
        
        const isReachable = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            testSocket.close()
            resolve(false)
          }, 3000)
          
          testSocket.onopen = () => {
            clearTimeout(timeout)
            testSocket.close()
            resolve(true)
          }
          
          testSocket.onerror = () => {
            clearTimeout(timeout)
            resolve(false)
          }
        })

        if (isReachable) {
          return true
        }
      } catch (error) {
        log('warn', `Server ${url} not reachable`, error)
      }
    }

    return false
  }

  // Test WebRTC connectivity
  private async testWebRTCConnectivity(): Promise<boolean> {
    try {
      const config = {
        iceServers: STREAM_CONFIG.WEBRTC.iceServers.slice(0, 3) // Test with first 3 STUN servers
      }
      
      const pc = new RTCPeerConnection(config)
      pc.createDataChannel('test')
      await pc.createOffer()
      
      // Wait for ICE gathering with timeout
      const iceComplete = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000)
        
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout)
            resolve(true)
          }
        })
      })
      
      pc.close()
      return iceComplete
    } catch {
      return false
    }
  }

  // Ping server for latency measurement with timeout
  private async pingServer(): Promise<number> {
    return new Promise((resolve) => {
      const start = performance.now()
      const timeout = setTimeout(() => resolve(5000), 2000) // Shorter timeout

      const handlePong = () => {
        clearTimeout(timeout)
        socketManager.off('heartbeat-ack', handlePong)
        resolve(performance.now() - start)
      }

      socketManager.on('heartbeat-ack', handlePong)
      
      // Send ping
      const socket = socketManager.connect()
      if (socket?.connected) {
        socket.emit('heartbeat', { timestamp: start })
      } else {
        clearTimeout(timeout)
        resolve(5000)
      }
    })
  }

  // Get connection type from Network Information API
  private getConnectionType(): string | undefined {
    try {
      if ('connection' in navigator) {
        const conn = (navigator as any).connection
        return conn?.effectiveType || conn?.type
      }
    } catch (error) {
      log('warn', 'Could not get connection type', error)
    }
    return undefined
  }

  // Enhanced connection quality assessment
  private assessOverallQuality(latency: number, networkStats: NetworkStats): 'excellent' | 'good' | 'fair' | 'poor' {
    if (!networkStats.online) return 'poor'
    
    let score = 0
    const maxScore = 100
    
    // Latency scoring (35% weight)
    if (latency < 50) score += 35
    else if (latency < 100) score += 28
    else if (latency < 200) score += 20
    else if (latency < 500) score += 12
    else if (latency < 1000) score += 5
    
    // Download speed scoring (25% weight)
    if (networkStats.downloadSpeed) {
      if (networkStats.downloadSpeed > 5000) score += 25
      else if (networkStats.downloadSpeed > 2000) score += 20
      else if (networkStats.downloadSpeed > 1000) score += 15
      else if (networkStats.downloadSpeed > 500) score += 10
      else if (networkStats.downloadSpeed > 100) score += 5
    } else {
      score += 10 // Neutral score if unknown
    }
    
    // Server reachability scoring (25% weight)
    if (networkStats.canReachServers) score += 25
    else if (networkStats.availableMethods.length > 0) score += 15
    
    // Connection type scoring (15% weight)
    const connType = networkStats.connectionType
    if (connType === '4g' || connType === 'wifi') score += 15
    else if (connType === '3g') score += 8
    else if (connType === '2g') score += 3
    else score += 10 // Unknown connection gets neutral score
    
    const percentage = (score / maxScore) * 100
    
    if (percentage >= 80) return 'excellent'
    else if (percentage >= 60) return 'good'
    else if (percentage >= 40) return 'fair'
    else return 'poor'
  }

  // Event emitter functionality
  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event) || []
    listeners.forEach(listener => {
      try {
        listener(data)
      } catch (error) {
        log('error', `Error in event listener for ${event}`, error)
      }
    })
  }

  // Public API methods
  public on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  public off(event: string, listener?: Function): void {
    const listeners = this.listeners.get(event)
    if (!listeners) return

    if (listener) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    } else {
      this.listeners.set(event, [])
    }
  }

  public getConnectionHealth(): ConnectionHealth {
    return { ...this.connectionHealth }
  }

  public getNetworkStats(): NetworkStats {
    return { ...this.networkStats }
  }

  // Force connection health check
  public async forceHealthCheck(): Promise<ConnectionHealth> {
    await this.checkConnectionHealth()
    await this.testNetworkPerformance()
    return this.getConnectionHealth()
  }

  // Get enhanced connection recommendations
  public getConnectionRecommendations(): string[] {
    const recommendations = []
    const health = this.connectionHealth
    const network = this.networkStats

    if (!network.online) {
      recommendations.push('Check your internet connection')
    }

    if (health.latency > 1000) {
      recommendations.push('Very high latency - consider switching to a faster network')
    } else if (health.latency > 500) {
      recommendations.push('High latency detected - streaming quality may be affected')
    }

    if (network.downloadSpeed && network.downloadSpeed < 500) {
      recommendations.push('Low bandwidth - consider reducing stream quality')
    } else if (network.downloadSpeed && network.downloadSpeed < 1000) {
      recommendations.push('Limited bandwidth - medium quality recommended')
    }

    if (!network.canReachServers && network.availableMethods.length === 0) {
      recommendations.push('Cannot reach servers and no fallback methods available - check firewall settings')
    } else if (!network.canReachServers) {
      recommendations.push('Using fallback connection methods - some features may be limited')
    }

    if (health.fallbackMode) {
      recommendations.push(`Using ${health.connectionMethod} fallback mode - functionality may be limited`)
    }

    if (health.retryCount > 3) {
      recommendations.push('Multiple connection failures - try clearing browser cache or using a different browser')
    }

    if (network.connectionType === '2g') {
      recommendations.push('2G connection detected - streaming may not work properly')
    } else if (network.connectionType === '3g') {
      recommendations.push('3G connection - consider switching to WiFi for better performance')
    }

    if (recommendations.length === 0) {
      if (health.quality === 'excellent') {
        recommendations.push('Connection is excellent - ready for high-quality streaming!')
      } else if (health.quality === 'good') {
        recommendations.push('Connection is good - streaming should work well')
      } else {
        recommendations.push('Connection is adequate for basic streaming')
      }
    }

    return recommendations
  }

  // Send message via BroadcastChannel
  public broadcastMessage(type: string, data: any): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type, data })
      } catch (error) {
        log('warn', 'Failed to broadcast message', error)
      }
    }
  }

  // Check if specific connection method is available
  public isMethodAvailable(method: string): boolean {
    return this.networkStats.availableMethods.includes(method)
  }

  // Get best available connection method
  public getBestConnectionMethod(): string {
    const methods = this.networkStats.availableMethods
    
    if (methods.includes('websocket')) return 'websocket'
    if (methods.includes('webrtc')) return 'webrtc-direct'
    if (methods.includes('broadcastchannel')) return 'broadcastchannel'
    if (methods.includes('localstorage')) return 'localstorage'
    
    return 'none'
  }

  // Cleanup
  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    if (this.networkTestInterval) {
      clearInterval(this.networkTestInterval)
      this.networkTestInterval = null
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.close()
      this.broadcastChannel = null
    }

    this.listeners.clear()
    log('info', '🧹 Connection manager destroyed')
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager()