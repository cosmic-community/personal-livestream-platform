'use client'

import { useState, useEffect, useRef } from 'react'

interface SimpleStreamViewerProps {
  serverUrl?: string
  streamId?: string
}

export default function SimpleStreamViewer({ 
  serverUrl = 'ws://localhost:3001',
  streamId 
}: SimpleStreamViewerProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isStreamAvailable, setIsStreamAvailable] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [error, setError] = useState<string>('')
  const [isInitializing, setIsInitializing] = useState(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    initializeViewer()
    return () => cleanup()
  }, [])

  const initializeViewer = async () => {
    try {
      setIsInitializing(true)
      await connectWebSocket()
      
      // Auto-join stream after connection
      setTimeout(() => {
        joinStream()
      }, 1000)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize')
    } finally {
      setIsInitializing(false)
    }
  }

  const connectWebSocket = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(serverUrl + '/ws')
        wsRef.current = ws

        ws.onopen = () => {
          console.log('✅ WebSocket connected')
          setIsConnected(true)
          resolve()
        }

        ws.onclose = () => {
          console.log('🔌 WebSocket disconnected')
          setIsConnected(false)
          setIsStreamAvailable(false)
        }

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error)
          reject(new Error('WebSocket connection failed'))
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            handleMessage(message)
          } catch (err) {
            console.error('❌ Error parsing message:', err)
          }
        }

        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            reject(new Error('Connection timeout'))
          }
        }, 10000)

      } catch (err) {
        reject(err)
      }
    })
  }

  const handleMessage = (message: any) => {
    switch (message.type) {
      case 'stream-available':
        setIsStreamAvailable(true)
        console.log('✅ Stream available:', message.sessionId)
        break
        
      case 'stream-unavailable':
        setIsStreamAvailable(false)
        if (videoRef.current) {
          videoRef.current.srcObject = null
        }
        break
        
      case 'stream-joined':
        setIsStreamAvailable(true)
        console.log('✅ Joined stream:', message.sessionId)
        break
        
      case 'viewer-count':
        setViewerCount(message.count)
        break
        
      case 'error':
        setError(message.message)
        break
    }
  }

  const joinStream = () => {
    if (!isConnected) return

    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'join-stream',
          sessionId: streamId,
          timestamp: new Date().toISOString()
        }))
      }
    } catch (err) {
      console.error('❌ Error joining stream:', err)
      setError('Failed to join stream')
    }
  }

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  if (isInitializing) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Connecting to stream...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="font-medium">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {!isStreamAvailable && isConnected && (
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-sm font-medium">
                Waiting for stream...
              </span>
            )}
          </div>
          
          {viewerCount > 0 && (
            <div className="text-sm text-gray-600">
              {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800 font-medium">Error</span>
            </div>
            <button
              onClick={() => setError('')}
              className="text-sm text-red-600 underline hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
        </div>
      )}

      {/* Video Player */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="aspect-video bg-gray-900 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            controls
            className="w-full h-full object-cover"
          />
          
          {/* Waiting Overlay */}
          {!isStreamAvailable && (
            <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
              <div className="text-center text-white">
                {!isConnected ? (
                  <>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-lg font-semibold">Connecting...</p>
                  </>
                ) : (
                  <>
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                    <p className="text-lg font-semibold mb-2">Waiting for Stream</p>
                    <p className="text-sm text-gray-300 mb-4">
                      Stream will appear automatically when broadcasting starts
                    </p>
                    <button
                      onClick={joinStream}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Check for Stream
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Live Indicator */}
          {isStreamAvailable && (
            <div className="absolute top-4 left-4">
              <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span>LIVE</span>
              </span>
            </div>
          )}

          {/* Viewer Count */}
          {viewerCount > 0 && (
            <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">
                  {viewerCount} watching
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stream Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Stream Viewer</h3>
            <p className="text-gray-600 text-sm">
              {isConnected ? 
                'Connected and ready to watch streams' : 
                'Disconnected from streaming server'
              }
            </p>
          </div>
          
          <div className="flex space-x-3">
            {!isConnected && (
              <button
                onClick={initializeViewer}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Reconnect
              </button>
            )}
            
            {isConnected && (
              <button
                onClick={joinStream}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Join Stream
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}