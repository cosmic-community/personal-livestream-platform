'use client'

import { useState, useEffect } from 'react'
import { socketManager } from '@/lib/socket'

interface ConnectionStatusProps {
  showDetails?: boolean
  className?: string
}

interface ConnectionHealth {
  connected: boolean
  fallbackMode: boolean
  reconnectAttempts: number
  currentUrl: string
  socketId?: string
  urlAttempts: number
  availableUrls: number
}

export default function ConnectionStatus({ showDetails = false, className = '' }: ConnectionStatusProps) {
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth | null>(null)
  const [connectionState, setConnectionState] = useState<string>('disconnected')
  const [isExpanded, setIsExpanded] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  useEffect(() => {
    // Get initial status
    updateStatus()

    // Update status every 5 seconds
    const interval = setInterval(updateStatus, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  const updateStatus = () => {
    try {
      const health = socketManager.getConnectionHealth()
      const state = socketManager.getConnectionState()
      
      setConnectionHealth(health)
      setConnectionState(state)
      setLastUpdate(new Date().toLocaleTimeString())
    } catch (error) {
      console.error('Failed to update connection status:', error)
    }
  }

  const handleReconnect = () => {
    socketManager.forceReconnect()
    // Update status after a brief delay
    setTimeout(updateStatus, 1000)
  }

  const getStatusColor = (state: string, fallbackMode: boolean) => {
    if (fallbackMode) return 'text-yellow-600 bg-yellow-100'
    
    switch (state) {
      case 'connected': return 'text-green-600 bg-green-100'
      case 'connecting': return 'text-blue-600 bg-blue-100'
      case 'fallback': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-red-600 bg-red-100'
    }
  }

  const getStatusText = (state: string, fallbackMode: boolean) => {
    if (fallbackMode) return 'Offline Mode'
    
    switch (state) {
      case 'connected': return 'Connected'
      case 'connecting': return 'Connecting...'
      case 'fallback': return 'Offline Mode'
      default: return 'Disconnected'
    }
  }

  const getStatusIcon = (state: string, fallbackMode: boolean) => {
    if (fallbackMode) {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )
    }

    switch (state) {
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

  const statusColor = getStatusColor(connectionState, connectionHealth.fallbackMode)
  const statusText = getStatusText(connectionState, connectionHealth.fallbackMode)
  const statusIcon = getStatusIcon(connectionState, connectionHealth.fallbackMode)

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
          <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
            {statusIcon}
            <span>{statusText}</span>
          </div>
          
          {connectionHealth.fallbackMode && (
            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
              Development Mode
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {connectionHealth.reconnectAttempts > 0 && (
            <span className="text-xs text-gray-500">
              {connectionHealth.reconnectAttempts} retries
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500 text-xs uppercase tracking-wide">Status</div>
              <div className="font-medium capitalize">{connectionState}</div>
            </div>
            
            <div>
              <div className="text-gray-500 text-xs uppercase tracking-wide">Socket ID</div>
              <div className="font-mono text-xs">
                {connectionHealth.socketId || 'None'}
              </div>
            </div>
            
            <div>
              <div className="text-gray-500 text-xs uppercase tracking-wide">Mode</div>
              <div className="font-medium">
                {connectionHealth.fallbackMode ? 'Offline' : 'Online'}
              </div>
            </div>
          </div>

          {/* Server Information */}
          <div className="text-sm">
            <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Server Status</div>
            <div className="space-y-1">
              {connectionHealth.availableUrls > 0 ? (
                <>
                  <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                    Current: {connectionHealth.currentUrl || 'None'}
                  </div>
                  <div className="text-xs text-gray-600">
                    Available servers: {connectionHealth.availableUrls}
                  </div>
                </>
              ) : (
                <div className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                  No WebSocket servers configured - running in development mode
                </div>
              )}
            </div>
          </div>

          {/* Connection Attempts */}
          {(connectionHealth.reconnectAttempts > 0 || connectionHealth.urlAttempts > 0) && (
            <div className="text-sm">
              <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">Connection Attempts</div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Reconnect attempts:</span>
                  <span className="ml-2 font-medium">{connectionHealth.reconnectAttempts}</span>
                </div>
                <div>
                  <span className="text-gray-500">URL attempts:</span>
                  <span className="ml-2 font-medium">{connectionHealth.urlAttempts}</span>
                </div>
              </div>
            </div>
          )}

          {/* Help Text */}
          {connectionHealth.fallbackMode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm">
                <div className="font-medium text-blue-900 mb-1">Development Mode Active</div>
                <div className="text-blue-700 text-xs">
                  The application is running in offline mode for development. 
                  To connect to a WebSocket server, configure SERVER_URLS in stream-config.ts 
                  or start the local server with <code className="bg-blue-100 px-1 rounded">npm run server</code>.
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t">
            <button
              onClick={updateStatus}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Refresh Status
            </button>
            
            {!connectionHealth.connected && (
              <button
                onClick={handleReconnect}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>

          {/* Last Updated */}
          {lastUpdate && (
            <div className="text-xs text-gray-500 text-right">
              Last updated: {lastUpdate}
            </div>
          )}
        </div>
      )}
    </div>
  )
}