import { socketManager } from '@/lib/socket'
import { STREAM_CONFIG, log, createStreamError } from '@/lib/stream-config'

export interface ConnectionHealth {
  status: 'connected' | 'connecting' | 'disconnected' | 'fallback'
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  latency: number
  retryCount: number
  lastConnected?: string
  serverUrl?: string
  fallbackMode: boolean
}

export interface NetworkStats {
  online: boolean
  latency: number
  downloadSpeed?: number
  uploadSpeed?: number
  connectionType?: string
  canReachServers: boolean
}

class ConnectionManager {
  private healthCheckInterval: NodeJS.Timeout | null = null
  private networkTestInterval: NodeJS.Timeout | null = null
  private connectionHealth: ConnectionHealth = {
    status: 'disconnected',
    quality: 'poor',
    latency: 0,
    retryCount: 0,
    fallbackMode: false
  }
  private networkStats: NetworkStats = {
    online: navigator.onLine,
    latency: 0,
    canReachServers: false
  }
  private listeners: Map<string, Function[]> = new Map()

  constructor() {
    this.initializeHealthMonitoring()
    this.setupNetworkMonitoring()
  }

  // Initialize connection health monitoring
  private initializeHealthMonitoring(): void {
    log('info', '🔍 Initializing connection health monitoring')

    this.healthCheckInterval = setInterval(() => {
      this.checkConnectionHealth()
    }, STREAM_CONFIG.CONNECTION.healthCheckInterval)

    // Initial health check
    setTimeout(() => this.checkConnectionHealth(), 1000)
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
    }, 60000) // Every minute

    // Initial network test
    setTimeout(() => this.testNetworkPerformance(), 2000)
  }

  // Check overall connection health
  private async checkConnectionHealth(): Promise<void> {
    try {
      const socketHealth = socketManager.getConnectionHealth()
      const isConnected = socketManager.isConnected()
      const isFallback = socketManager.isFallbackMode()

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
        fallbackMode: isFallback
      }

      // Emit status change if different
      if (previousStatus !== this.connectionHealth.status) {
        log('info', `🔄 Connection status changed: ${previousStatus} → ${this.connectionHealth.status}`)
        this.emit('connection-status-changed', this.connectionHealth)
      }

      // Emit regular health updates
      this.emit('health-update', this.connectionHealth)

    } catch (error) {
      log('error', '❌ Error checking connection health', error)
    }
  }

  // Test network performance
  private async testNetworkPerformance(): Promise<void> {
    try {
      const testResults = await Promise.allSettled([
        this.testLatency(),
        this.testDownloadSpeed(),
        this.testServerReachability()
      ])

      const [latencyResult, speedResult, reachabilityResult] = testResults

      this.networkStats = {
        online: navigator.onLine,
        latency: latencyResult.status === 'fulfilled' ? latencyResult.value : 5000,
        downloadSpeed: speedResult.status === 'fulfilled' ? speedResult.value : undefined,
        connectionType: this.getConnectionType(),
        canReachServers: reachabilityResult.status === 'fulfilled' ? reachabilityResult.value : false
      }

      log('info', '📊 Network performance test completed', this.networkStats)
      this.emit('network-performance-update', this.networkStats)

    } catch (error) {
      log('error', '❌ Error testing network performance', error)
    }
  }

  // Test latency to multiple endpoints
  private async testLatency(): Promise<number> {
    const testUrls = [
      'https://www.google.com/favicon.ico',
      'https://www.cloudflare.com/favicon.ico',
      'https://cdn.jsdelivr.net/npm/react@18.0.0/package.json'
    ]

    const latencies = await Promise.allSettled(
      testUrls.map(async (url) => {
        const start = performance.now()
        try {
          await fetch(url, { 
            mode: 'no-cors',
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000)
          })
          return performance.now() - start
        } catch {
          return 5000 // High penalty for failed requests
        }
      })
    )

    const successfulLatencies = latencies
      .filter((result): result is PromiseFulfilledResult<number> => result.status === 'fulfilled')
      .map(result => result.value)

    return successfulLatencies.length > 0 ? Math.min(...successfulLatencies) : 5000
  }

  // Test download speed
  private async testDownloadSpeed(): Promise<number> {
    try {
      const testUrl = 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'
      const start = performance.now()
      
      const response = await fetch(testUrl, {
        cache: 'no-cache',
        signal: AbortSignal.timeout(10000)
      })
      
      const data = await response.arrayBuffer()
      const duration = (performance.now() - start) / 1000 // Convert to seconds
      
      return (data.byteLength * 8) / duration / 1000 // Convert to Kbps
    } catch {
      return 0
    }
  }

  // Test if streaming servers are reachable
  private async testServerReachability(): Promise<boolean> {
    try {
      // Test if we can create WebRTC connections
      const pc = new RTCPeerConnection(STREAM_CONFIG.WEBRTC)
      pc.createDataChannel('test')
      await pc.createOffer()
      
      // Wait briefly for ICE gathering
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 2000)
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout)
            resolve(undefined)
          }
        })
      })
      
      const canReach = pc.iceGatheringState === 'complete'
      pc.close()
      
      return canReach
    } catch {
      return false
    }
  }

  // Ping server for latency measurement
  private async pingServer(): Promise<number> {
    return new Promise((resolve) => {
      const start = performance.now()
      const timeout = setTimeout(() => resolve(5000), 3000)

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
    if ('connection' in navigator) {
      const conn = (navigator as any).connection
      return conn?.effectiveType || conn?.type
    }
    return undefined
  }

  // Assess overall connection quality
  private assessOverallQuality(latency: number, networkStats: NetworkStats): 'excellent' | 'good' | 'fair' | 'poor' {
    if (!networkStats.online) return 'poor'
    
    let score = 0
    
    // Latency scoring (40% weight)
    if (latency < 50) score += 40
    else if (latency < 100) score += 30
    else if (latency < 200) score += 20
    else if (latency < 500) score += 10
    
    // Download speed scoring (30% weight)
    if (networkStats.downloadSpeed) {
      if (networkStats.downloadSpeed > 5000) score += 30
      else if (networkStats.downloadSpeed > 2000) score += 25
      else if (networkStats.downloadSpeed > 1000) score += 20
      else if (networkStats.downloadSpeed > 500) score += 15
      else if (networkStats.downloadSpeed > 100) score += 10
    }
    
    // Server reachability scoring (20% weight)
    if (networkStats.canReachServers) score += 20
    
    // Connection type scoring (10% weight)
    const connType = networkStats.connectionType
    if (connType === '4g' || connType === 'wifi') score += 10
    else if (connType === '3g') score += 5
    
    if (score >= 80) return 'excellent'
    else if (score >= 60) return 'good'
    else if (score >= 40) return 'fair'
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

  // Get connection recommendations
  public getConnectionRecommendations(): string[] {
    const recommendations = []
    const health = this.connectionHealth
    const network = this.networkStats

    if (!network.online) {
      recommendations.push('Check your internet connection')
    }

    if (health.latency > 500) {
      recommendations.push('High latency detected - consider switching to a better network')
    }

    if (network.downloadSpeed && network.downloadSpeed < 500) {
      recommendations.push('Low bandwidth detected - streaming quality may be reduced')
    }

    if (!network.canReachServers) {
      recommendations.push('Cannot reach streaming servers - check firewall or proxy settings')
    }

    if (health.fallbackMode) {
      recommendations.push('Running in offline mode - streams will work locally only')
    }

    if (health.retryCount > 3) {
      recommendations.push('Multiple connection attempts failed - try refreshing the page')
    }

    if (recommendations.length === 0) {
      recommendations.push('Connection looks good!')
    }

    return recommendations
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

    this.listeners.clear()
    log('info', '🧹 Connection manager destroyed')
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager()

// Export types
export type { ConnectionHealth, NetworkStats }