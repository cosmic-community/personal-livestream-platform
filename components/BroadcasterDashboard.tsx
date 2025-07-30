'use client'

import { useState, useEffect, useRef } from 'react'
import { StreamState, StreamType } from '@/types'
import StreamControls from '@/components/StreamControls'
import StreamPreview from '@/components/StreamPreview'
import StreamStats from '@/components/StreamStats'

export default function BroadcasterDashboard() {
  const [streamState, setStreamState] = useState<StreamState>({
    isLive: false,
    isConnecting: false,
    streamType: 'webcam',
    webcamEnabled: false,
    screenEnabled: false,
    viewerCount: 0
  })

  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  
  const streamRef = useRef<MediaStream | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket()
    return () => {
      cleanup()
    }
  }, [])

  const connectWebSocket = () => {
    try {
      setConnectionStatus('connecting')
      setError(null)
      
      // Try primary server first, fallback to localhost
      const wsUrl = process.env.NODE_ENV === 'production' 
        ? 'ws://your-server.com:3001'  // Replace with your actual server URL
        : 'ws://localhost:3001'
      
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('✅ WebSocket connected')
        setConnectionStatus('connected')
        setError(null)
        
        // Send heartbeat every 30 seconds
        const heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }))
          } else {
            clearInterval(heartbeat)
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleWebSocketMessage(data)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason)
        setConnectionStatus('disconnected')
        
        // Auto-reconnect if not a clean close
        if (event.code !== 1000) {
          setTimeout(() => {
            if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
              connectWebSocket()
            }
          }, 3000)
        }
      }

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        setError('Connection failed. Retrying...')
        setConnectionStatus('disconnected')
      }

    } catch (error) {
      console.error('❌ WebSocket connection error:', error)
      setError('Unable to connect to streaming server')
      setConnectionStatus('disconnected')
    }
  }

  const handleWebSocketMessage = (data: any) => {
    console.log('📨 WebSocket message:', data.type)
    
    switch (data.type) {
      case 'stream-started':
        sessionIdRef.current = data.sessionId
        setStreamState(prev => ({
          ...prev,
          isLive: true,
          isConnecting: false
        }))
        setError(null)
        break
        
      case 'stream-ended':
        handleStreamEnd()
        break
        
      case 'viewer-count':
        setStreamState(prev => ({ ...prev, viewerCount: data.count }))
        break
        
      case 'error':
        console.error('Server error:', data.message)
        setError(data.message)
        setStreamState(prev => ({ ...prev, isConnecting: false, isLive: false }))
        break
        
      case 'heartbeat-ack':
        console.log('💓 Heartbeat acknowledged')
        break
    }
  }

  const sendWebSocketMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
      return true
    }
    return false
  }

  const handleStartStream = async (streamType: StreamType) => {
    if (connectionStatus !== 'connected') {
      setError('Not connected to streaming server. Please wait for connection.')
      return
    }

    console.log('🚀 Starting stream:', streamType)
    setStreamState(prev => ({ ...prev, isConnecting: true }))
    setError(null)

    try {
      // Get media stream
      let stream: MediaStream

      if (streamType === 'webcam') {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
      } else if (streamType === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true
        })
      } else {
        // Both - get webcam first, then screen
        const webcamStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })
        
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        })

        // Combine streams (simplified approach)
        stream = new MediaStream([
          ...webcamStream.getVideoTracks(),
          ...screenStream.getVideoTracks(),
          ...webcamStream.getAudioTracks()
        ])
      }

      streamRef.current = stream

      // Notify server to start broadcast
      const success = sendWebSocketMessage({
        type: 'start-broadcast',
        streamType,
        timestamp: Date.now()
      })

      if (!success) {
        throw new Error('Failed to communicate with server')
      }

      // Update state
      setStreamState(prev => ({
        ...prev,
        streamType,
        webcamEnabled: streamType === 'webcam' || streamType === 'both',
        screenEnabled: streamType === 'screen' || streamType === 'both'
      }))

      console.log('✅ Stream started successfully')

    } catch (error) {
      console.error('❌ Error starting stream:', error)
      
      let errorMessage = 'Failed to start stream. '
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage += 'Please allow camera and microphone permissions.'
        } else if (error.name === 'NotFoundError') {
          errorMessage += 'Camera or microphone not found.'
        } else if (error.name === 'NotReadableError') {
          errorMessage += 'Camera or microphone is in use.'
        } else {
          errorMessage += error.message
        }
      }

      setError(errorMessage)
      setStreamState(prev => ({ ...prev, isConnecting: false, isLive: false }))
      
      // Clean up stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }

  const handleStopStream = () => {
    console.log('🛑 Stopping stream')
    
    // Notify server
    sendWebSocketMessage({
      type: 'stop-broadcast',
      sessionId: sessionIdRef.current,
      timestamp: Date.now()
    })

    handleStreamEnd()
  }

  const handleStreamEnd = () => {
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Reset state
    setStreamState({
      isLive: false,
      isConnecting: false,
      streamType: 'webcam',
      webcamEnabled: false,
      screenEnabled: false,
      viewerCount: 0
    })
    
    sessionIdRef.current = null
    setError(null)
  }

  const handleToggleWebcam = async () => {
    if (!streamState.isLive || !streamRef.current) return

    try {
      if (streamState.webcamEnabled) {
        // Remove webcam tracks
        const videoTracks = streamRef.current.getVideoTracks()
        videoTracks.forEach(track => {
          if (track.label.toLowerCase().includes('camera')) {
            track.stop()
            streamRef.current?.removeTrack(track)
          }
        })
        setStreamState(prev => ({ ...prev, webcamEnabled: false }))
      } else {
        // Add webcam tracks
        const webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        webcamStream.getTracks().forEach(track => {
          streamRef.current?.addTrack(track)
        })
        setStreamState(prev => ({ ...prev, webcamEnabled: true }))
      }
    } catch (error) {
      console.error('❌ Error toggling webcam:', error)
      setError('Failed to toggle webcam')
    }
  }

  const handleToggleScreen = async () => {
    if (!streamState.isLive || !streamRef.current) return

    try {
      if (streamState.screenEnabled) {
        // Remove screen tracks
        const videoTracks = streamRef.current.getVideoTracks()
        videoTracks.forEach(track => {
          if (!track.label.toLowerCase().includes('camera')) {
            track.stop()
            streamRef.current?.removeTrack(track)
          }
        })
        setStreamState(prev => ({ ...prev, screenEnabled: false }))
      } else {
        // Add screen tracks
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        screenStream.getTracks().forEach(track => {
          streamRef.current?.addTrack(track)
        })
        setStreamState(prev => ({ ...prev, screenEnabled: true }))
      }
    } catch (error) {
      console.error('❌ Error toggling screen share:', error)
      setError('Failed to toggle screen share')
    }
  }

  const cleanup = () => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounting')
      wsRef.current = null
    }

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const retryConnection = () => {
    cleanup()
    setTimeout(() => {
      connectWebSocket()
    }, 1000)
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Connection Status</h2>
          {connectionStatus === 'disconnected' && (
            <button
              onClick={retryConnection}
              className="btn btn-sm btn-primary"
            >
              Retry Connection
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 
            connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
            'bg-red-500'
          }`}></div>
          <span className="font-medium">
            {connectionStatus === 'connected' ? 'Connected to streaming server' : 
             connectionStatus === 'connecting' ? 'Connecting...' : 
             'Disconnected from streaming server'}
          </span>
        </div>
        
        {connectionStatus === 'connected' && (
          <p className="text-sm text-gray-600 mt-2">
            Ready to start streaming
          </p>
        )}
        
        {connectionStatus === 'disconnected' && (
          <p className="text-sm text-red-600 mt-2">
            Cannot start streaming without server connection
          </p>
        )}
      </div>

      {/* Stream Controls */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Broadcasting Controls</h2>
        <StreamControls
          streamState={streamState}
          onStartStream={handleStartStream}
          onStopStream={handleStopStream}
          onToggleWebcam={handleToggleWebcam}
          onToggleScreen={handleToggleScreen}
        />
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-red-800 text-sm font-medium">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-sm text-red-600 underline hover:text-red-800 mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stream Preview */}
      {streamRef.current && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
          <StreamPreview stream={streamRef.current} />
        </div>
      )}

      {/* Stream Stats */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Stream Statistics</h2>
        <StreamStats
          session={undefined}
          isLive={streamState.isLive}
          viewerCount={streamState.viewerCount}
        />
      </div>
    </div>
  )
}