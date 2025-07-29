'use client'

import { useState, useEffect } from 'react'
import { connectionManager, ConnectionHealth, NetworkStats } from '@/lib/connection-manager'
import { socketManager } from '@/lib/socket'

interface ConnectionStatusProps {
  showDetails?: boolean
  className?: string
}

export default function ConnectionStatus({ showDetails = false, className = '' }: ConnectionStatusProps) {
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth | null>(null)
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null)
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // Get initial status
    updateStatus()

    // Listen for connection changes
    const handleHealthUpdate = (health: ConnectionHealth) => {
      setConnectionHealth(health)
      setRecommendations(connectionManager.getConnectionRecommendations())
    }

    const handleNetworkUpdate = (network: NetworkStats) => {
      setNetworkStats(network)
    }

    connectionManager.on('health-update', handleHealthUpdate)
    connectionManager.on('network-performance-update', handleNetworkUpdate)
    connectionManager.on('connection-status-changed', handleHealthUpdate)

    // Update status every 10 seconds
    const interval = setInterval(updateStatus, 10000)

    return () => {
      connectionManager.off('health-update', handleHealthUpdate)
      connectionManager.off('network-performance-update', handleNetworkUpdate)
      connectionManager.off('connection-status-changed', handleHealthUpdate)
      clearInterval(interval)
    }
  }, [])

  const updateStatus = async () => {
    try {
      const health = connectionManager.getConnectionHealth()
      const network = connectionManager.getNetworkStats()
      const recs = connectionManager.getConnectionRecommendations()
      
      setConnectionHealth(health)
      setNetworkStats(network)
      setRecommendations(recs)
    } catch (error) {
      console.error('Failed to update connection status:', error)
    }
  }

  const handleForceCheck = async () => {
    try {
      await connectionManager.forceHealthCheck()
    } catch (error) {
      console.error('Failed to force health check:', error)
    }
  }

  const handleReconnect = () => {
    socketManager.forceReconnect()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600 bg-green-100'
      case 'connecting': return 'text-blue-600 bg-blue-100'
      case 'fallback': return 'text-yellow-600 bg-yellow-100'
      case 'p2p': return 'text-purple-600 bg-purple-100'
      default: return 'text-red-600 bg-red-100'
    }
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'fair': return 'text-yellow-600'
      default: return 'text-red-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )
      case 'connecting':
        return (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )
      case 'fallback':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  if (!connectionHealth) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
        <span className="text-sm text-gray-500">Checking connection...</span>
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Main Status */}
      <div 
        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 ${
          showDetails ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(connectionHealth.status)}`}>
            {getStatusIcon(connectionHealth.status)}
            <span className="capitalize">{connectionHealth.status}</span>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className={`font-medium ${getQualityColor(connectionHealth.quality)}`}>
              {connectionHealth.quality.charAt(0).toUpperCase() + connectionHealth.quality.slice(1)}
            </span>
            
            {connectionHealth.latency > 0 && (
              <span>
                {Math.round(connectionHealth.latency)}ms
              </span>
            )}
            
            {connectionHealth.fallbackMode && (
              <span className="text-yellow-600 text-xs">
                ({connectionHealth.connectionMethod})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connectionHealth.retryCount > 0 && (
            <span className="text-xs text-gray-500">
              {connectionHealth.retryCount} retries
            </span>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Detailed Information */}
      {(isExpanded || showDetails) && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          {/* Connection Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500 text-xs uppercase tracking-wide">Method</div>
              <div className="font-medium capitalize">{connectionHealth.connectionMethod}</div>
            </div>
            
            <div>
              <div className="text-gray-500 text-xs uppercase tracking-wide">Latency</div>
              <div className={`font-medium ${
                connectionHealth.latency < 100 ? 'text-green-600' : 
                connectionHealth.latency < 300 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {Math.round(connectionHealth.latency)}ms
              </div>
            </div>
            
            {networkStats && (
              <>
                <div>
                  <div className="text-gray-500 text-xs uppercase tracking-wide">Network</div>
                  <div className={`font-medium ${networkStats.online ? 'text-green-600' : 'text-red-600'}`}>
                    {networkStats.online ? 'Online' : 'Offline'}
                  </div>
                </div>
                
                {networkStats.downloadSpeed && (
                  <div>
                    <div className="text-gray-500 text-xs uppercase tracking-wide">Speed</div>
                    <div className="font-medium">
                      {Math.round(networkStats.downloadSpeed)} Kbps
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Server Information */}
          {connectionHealth.serverUrl && (
            <div className="text-sm">
              <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Server</div>
              <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {connectionHealth.serverUrl}
              </div>
            </div>
          )}

          {/* Available Methods */}
          {networkStats?.availableMethods && networkStats.availableMethods.length > 0 && (
            <div className="text-sm">
              <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">Available Methods</div>
              <div className="flex flex-wrap gap-1">
                {networkStats.availableMethods.map((method) => (
                  <span 
                    key={method}
                    className={`px-2 py-1 rounded text-xs ${
                      method === connectionHealth.connectionMethod 
                        ? 'bg-blue-100 text-blue-800 font-medium' 
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div>
              <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">Recommendations</div>
              <div className="space-y-1">
                {recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <div className="w-1 h-1 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t">
            <button
              onClick={handleForceCheck}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Test Connection
            </button>
            
            {connectionHealth.status !== 'connected' && (
              <button
                onClick={handleReconnect}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>

          {/* Last Updated */}
          {connectionHealth.lastConnected && (
            <div className="text-xs text-gray-500 text-right">
              Last connected: {new Date(connectionHealth.lastConnected).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}