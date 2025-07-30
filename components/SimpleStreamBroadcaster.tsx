'use client'

import { useState, useEffect, useRef } from 'react'

export default function SimpleStreamBroadcaster() {
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [error, setError] = useState<string>('')
  const [isInitializing, setIsInitializing] = useState(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    initializeBroadcaster()
    return () => cleanup()
  }, [])

  const initializeBroadcaster = async () => {
    try {
      setIsInitializing(true)
      await connectWebSocket()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize')
    } finally {
      setIsInitializing(false)
    }
  }

  const connectWebSocket = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket('ws://localhost:3001/ws')
        wsRef.current = ws

        ws.onopen = () => {
          console.log('✅ WebSocket connected')
          setIsConnected(true)
          resolve()
        }

        ws.onclose = () => {
          console.log('🔌 WebSocket disconnected')
          setIsConnected(false)
          setIsStreaming(false)
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
      case 'stream-started':
        setIsStreaming(true)
        break
      case 'stream-ended':
        setIsStreaming(false)
        break
      case 'viewer-count':
        setViewerCount(message.count)
        break
      case 'error':
        setError(message.message)
        break
    }
  }

  const startStream = async (streamType: 'webcam' | 'screen') => {
    try {
      setError('')

      let stream: MediaStream
      if (streamType === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        })
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(console.error)
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'start-broadcast',
          streamType,
          timestamp: new Date().toISOString()
        }))
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start stream'
      setError(errorMsg)
      throw err
    }
  }

  const stopStream = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'stop-broadcast',
          timestamp: new Date().toISOString()
        }))
      }

      setIsStreaming(false)

    } catch (err) {
      console.error('❌ Error stopping stream:', err)
    }
  }

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  if (isInitializing) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing broadcaster...</p>
        </div>
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
            {isStreaming && (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-medium">
                LIVE
              </span>
            )}
          </div>
          
          {isStreaming && (
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

      {/* Stream Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Broadcasting Controls</h2>
        
        {!isStreaming ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => startStream('webcam')}
              disabled={!isConnected}
              className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
              <span>Start Webcam</span>
            </button>

            <button
              onClick={() => startStream('screen')}
              disabled={!isConnected}
              className="flex items-center justify-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 8V5h12v7H4z" clipRule="evenodd" />
              </svg>
              <span>Start Screen Share</span>
            </button>
          </div>
        ) : (
          <div className="text-center">
            <button
              onClick={stopStream}
              className="flex items-center justify-center space-x-2 bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 mx-auto transition-colors"
            >
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <span>Stop Stream</span>
            </button>
          </div>
        )}
      </div>

      {/* Video Preview */}
      {isStreaming && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Live Preview</h3>
          <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4">
              <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span>LIVE</span>
              </span>
            </div>
            <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
              <span className="text-sm">{viewerCount} watching</span>
            </div>
          </div>
        </div>
      )}

      {/* Stream Information */}
      {isStreaming && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Stream Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {viewerCount}
              </div>
              <div className="text-gray-600">Current Viewers</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {isConnected ? 'Online' : 'Offline'}
              </div>
              <div className="text-gray-600">Connection Status</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}