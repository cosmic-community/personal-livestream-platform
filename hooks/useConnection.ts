import { useState, useEffect, useCallback } from 'react'
import { ConnectionManager, ConnectionHealth, NetworkStats } from '@/lib/connection-manager'
import { socketManager } from '@/lib/socket'

const connectionManager = new ConnectionManager()

interface ConnectionInfo {
  health: ConnectionHealth | null
  network: NetworkStats | null
  recommendations: string[]
  isConnected: boolean
  socketState: string
}

export function useConnection() {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    health: null,
    network: null,
    recommendations: [],
    isConnected: false,
    socketState: 'disconnected'
  })

  const [isChecking, setIsChecking] = useState(false)

  // Update connection info
  const updateConnectionInfo = useCallback(() => {
    const health = connectionManager.getConnectionHealth()
    const network = connectionManager.getNetworkStats()
    const recommendations = connectionManager.getConnectionRecommendations()
    const isConnected = socketManager.isConnected()
    const socketState = socketManager.getConnectionState()

    setConnectionInfo({
      health,
      network,
      recommendations,
      isConnected,
      socketState
    })
  }, [])

  useEffect(() => {
    // Initial update
    updateConnectionInfo()

    // Set up event listeners
    const handleHealthUpdate = () => updateConnectionInfo()
    const handleNetworkUpdate = () => updateConnectionInfo()
    const handleConnectionChange = () => updateConnectionInfo()

    connectionManager.on('health-update', handleHealthUpdate)
    connectionManager.on('network-performance-update', handleNetworkUpdate)
    connectionManager.on('connection-status-changed', handleConnectionChange)

    // Update every 10 seconds
    const interval = setInterval(updateConnectionInfo, 10000)

    return () => {
      connectionManager.off('health-update', handleHealthUpdate)
      connectionManager.off('network-performance-update', handleNetworkUpdate)
      connectionManager.off('connection-status-changed', handleConnectionChange)
      clearInterval(interval)
    }
  }, [updateConnectionInfo])

  // Force health check
  const forceHealthCheck = useCallback(async () => {
    setIsChecking(true)
    try {
      await connectionManager.forceHealthCheck()
      updateConnectionInfo()
    } catch (error) {
      console.error('Failed to perform health check:', error)
    } finally {
      setIsChecking(false)
    }
  }, [updateConnectionInfo])

  // Force reconnection
  const forceReconnect = useCallback(() => {
    socketManager.forceReconnect()
    updateConnectionInfo()
  }, [updateConnectionInfo])

  // Get connection quality
  const getConnectionQuality = useCallback(() => {
    return connectionInfo.health?.quality || 'poor'
  }, [connectionInfo.health?.quality])

  // Check if connection method is available
  const isMethodAvailable = useCallback((method: string) => {
    return connectionManager.isMethodAvailable(method)
  }, [])

  // Get best available connection method
  const getBestConnectionMethod = useCallback(() => {
    return connectionManager.getBestConnectionMethod()
  }, [])

  // Check if in fallback mode
  const isFallbackMode = useCallback(() => {
    return socketManager.isFallbackMode()
  }, [])

  // Get connection latency
  const getLatency = useCallback(() => {
    return connectionInfo.health?.latency || 0
  }, [connectionInfo.health?.latency])

  // Check if network is online
  const isOnline = useCallback(() => {
    return connectionInfo.network?.online ?? navigator.onLine
  }, [connectionInfo.network?.online])

  // Get network speed
  const getNetworkSpeed = useCallback(() => {
    return connectionInfo.network?.downloadSpeed || 0
  }, [connectionInfo.network?.downloadSpeed])

  // Get connection type
  const getConnectionType = useCallback(() => {
    return connectionInfo.network?.connectionType || 'unknown'
  }, [connectionInfo.network?.connectionType])

  // Send broadcast message to other tabs
  const broadcastToTabs = useCallback((type: string, data: any) => {
    connectionManager.broadcastMessage(type, data)
  }, [])

  return {
    // Connection info
    ...connectionInfo,
    
    // Status flags
    isChecking,
    
    // Actions
    forceHealthCheck,
    forceReconnect,
    broadcastToTabs,
    
    // Getters
    getConnectionQuality,
    isMethodAvailable,
    getBestConnectionMethod,
    isFallbackMode,
    getLatency,
    isOnline,
    getNetworkSpeed,
    getConnectionType,
    
    // Computed values
    hasRecommendations: connectionInfo.recommendations.length > 0,
    isHealthy: connectionInfo.health?.quality === 'excellent' || connectionInfo.health?.quality === 'good',
    needsAttention: connectionInfo.health?.quality === 'poor' || connectionInfo.recommendations.length > 2
  }
}