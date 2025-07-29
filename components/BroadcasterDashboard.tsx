'use client'

import { useState, useEffect, useRef } from 'react'
import { StreamState, StreamType, StreamSession } from '@/types'
import StreamControls from '@/components/StreamControls'
import StreamPreview from '@/components/StreamPreview'
import StreamStats from '@/components/StreamStats'
import { socketManager } from '@/lib/socket'
import { checkWebRTCSupport, getUserMediaStream, createPeerConnection, createOffer, stopMediaStream, combineStreams } from '@/lib/webrtc'

export default function BroadcasterDashboard() {
  const [streamState, setStreamState] = useState<StreamState>({
    isLive: false,
    isConnecting: false,
    streamType: 'webcam',
    webcamEnabled: false,
    screenEnabled: false,
    viewerCount: 0
  })

  const [currentSession, setCurrentSession] = useState<StreamSession | undefined>(undefined)
  const [webrtcSupported, setWebrtcSupported] = useState(true)
  const [connectionState, setConnectionState] = useState<string>('disconnected')
  const streamRef = useRef<MediaStream | null>(null)
  const webcamStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const connectionRetryRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Check WebRTC support
    setWebrtcSupported(checkWebRTCSupport())

    // Initialize socket connection
    initializeConnection()

    return () => {
      if (connectionRetryRef.current) {
        clearTimeout(connectionRetryRef.current)
      }
      socketManager.disconnect()
      cleanupStreams()
    }
  }, [])

  const initializeConnection = async () => {
    try {
      console.log('🔌 Initializing streaming server connection...')
      setConnectionState('connecting')
      
      const socket = socketManager.connect()
      
      // Monitor connection state
      const checkConnection = () => {
        const state = socketManager.getConnectionState()
        setConnectionState(state)
        
        if (state === 'connected') {
          console.log('✅ Successfully connected to streaming server')
          setupSocketEventListeners()
          setStreamState(prev => ({ ...prev, error: undefined }))
        } else if (state === 'disconnected' && !socketManager.isConnected()) {
          console.log('❌ Connection failed, retrying in 5 seconds...')
          setStreamState(prev => ({
            ...prev,
            error: 'Lost connection to streaming server. Attempting to reconnect...'
          }))
          
          // Retry connection after 5 seconds
          connectionRetryRef.current = setTimeout(() => {
            initializeConnection()
          }, 5000)
        }
      }

      // Check connection status immediately and then every 2 seconds
      checkConnection()
      const connectionInterval = setInterval(checkConnection, 2000)

      // Clean up interval after 30 seconds
      setTimeout(() => {
        clearInterval(connectionInterval)
      }, 30000)

    } catch (error) {
      console.error('❌ Failed to initialize streaming server connection:', error)
      setConnectionState('disconnected')
      setStreamState(prev => ({
        ...prev,
        error: 'Failed to connect to streaming server. Please check your internet connection and try refreshing the page.'
      }))
    }
  }

  const setupSocketEventListeners = () => {
    // Setup socket event listeners
    socketManager.onStreamStarted((data) => {
      console.log('✅ Stream started event received:', data)
      const session: StreamSession = {
        id: data.sessionId,
        slug: `session-${data.sessionId}`,
        title: `Stream Session ${data.sessionId}`,
        type: 'stream-sessions',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        metadata: {
          start_time: new Date().toISOString(),
          stream_type: data.streamType,
          viewer_count: 0,
          peak_viewers: 0,
          duration: 0,
          status: 'live',
        }
      }
      setCurrentSession(session)
      setStreamState(prev => ({
        ...prev,
        isLive: true,
        isConnecting: false,
        sessionId: data.sessionId,
        error: undefined
      }))
    })

    socketManager.onStreamEnded((data) => {
      console.log('🛑 Stream ended event received:', data)
      handleStopStream()
    })

    socketManager.onViewerCount((count) => {
      setStreamState(prev => ({ ...prev, viewerCount: count }))
      if (currentSession) {
        setCurrentSession(prev => prev ? {
          ...prev,
          metadata: {
            ...prev.metadata,
            viewer_count: count,
            peak_viewers: Math.max(prev.metadata.peak_viewers || 0, count)
          }
        } : prev)
      }
    })

    socketManager.onStreamError((error) => {
      console.error('❌ Stream error received:', error)
      setStreamState(prev => ({
        ...prev,
        error: error.message || 'Stream error occurred',
        isConnecting: false,
        isLive: false
      }))
    })
  }

  const cleanupStreams = () => {
    if (streamRef.current) {
      stopMediaStream(streamRef.current)
      streamRef.current = null
    }
    if (webcamStreamRef.current) {
      stopMediaStream(webcamStreamRef.current)
      webcamStreamRef.current = null
    }
    if (screenStreamRef.current) {
      stopMediaStream(screenStreamRef.current)
      screenStreamRef.current = null
    }
    // Close all peer connections
    peerConnectionsRef.current.forEach(pc => pc.close())
    peerConnectionsRef.current.clear()
  }

  const handleStartStream = async (streamType: StreamType) => {
    if (!webrtcSupported) {
      setStreamState(prev => ({
        ...prev,
        error: 'WebRTC is not supported in your browser'
      }))
      return
    }

    // Check socket connection first
    if (!socketManager.isConnected()) {
      setStreamState(prev => ({
        ...prev,
        error: 'Not connected to streaming server. Please wait for connection or refresh the page.',
        isConnecting: false
      }))
      
      // Try to reconnect
      initializeConnection()
      return
    }

    console.log('🚀 Starting stream with type:', streamType)
    setStreamState(prev => ({
      ...prev,
      isConnecting: true,
      error: undefined,
      streamType
    }))

    try {
      let finalStream: MediaStream

      if (streamType === 'both') {
        // Get both webcam and screen streams
        console.log('📹 Getting webcam and screen streams...')
        const [webcamStream, screenStream] = await Promise.all([
          getUserMediaStream('webcam').catch(err => {
            console.warn('⚠️ Webcam access failed:', err)
            return null
          }),
          getUserMediaStream('screen').catch(err => {
            console.warn('⚠️ Screen access failed:', err)
            return null
          })
        ])

        if (!webcamStream && !screenStream) {
          throw new Error('Failed to access both camera and screen. Please grant permissions.')
        }

        const streams = [webcamStream, screenStream].filter(Boolean) as MediaStream[]
        finalStream = await combineStreams(streams)
        
        webcamStreamRef.current = webcamStream
        screenStreamRef.current = screenStream
      } else {
        // Get single stream type
        console.log(`📹 Getting ${streamType} stream...`)
        finalStream = await getUserMediaStream(streamType)
        
        if (streamType === 'webcam') {
          webcamStreamRef.current = finalStream
        } else {
          screenStreamRef.current = finalStream
        }
      }

      streamRef.current = finalStream

      // Start socket broadcast and wait for confirmation
      console.log('📡 Starting socket broadcast...')
      await socketManager.startBroadcast(streamType)

      // Update stream state after successful socket broadcast
      setStreamState(prev => ({
        ...prev,
        webcamEnabled: streamType === 'webcam' || streamType === 'both',
        screenEnabled: streamType === 'screen' || streamType === 'both'
      }))

      console.log('✅ Stream started successfully')

    } catch (error) {
      console.error('❌ Error starting stream:', error)
      
      // Clean up any partially created streams
      cleanupStreams()

      let errorMessage = 'Failed to start stream. '
      
      if (error instanceof Error) {
        if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
          errorMessage += 'Please grant camera and microphone permissions.'
        } else if (error.message.includes('timeout')) {
          errorMessage += 'Server connection timeout. Please check your internet connection and try again.'
        } else if (error.message.includes('not connected') || error.message.includes('Not connected')) {
          errorMessage += 'Connection to streaming server lost. Please refresh the page.'
        } else {
          errorMessage += error.message
        }
      } else {
        errorMessage += 'Unknown error occurred. Please try again.'
      }

      setStreamState(prev => ({
        ...prev,
        error: errorMessage,
        isConnecting: false,
        isLive: false
      }))
    }
  }

  const handleStopStream = () => {
    console.log('🛑 Stopping stream...')
    
    // Stop socket broadcast
    socketManager.stopBroadcast()

    // Clean up all streams
    cleanupStreams()

    // Reset state
    setStreamState({
      isLive: false,
      isConnecting: false,
      streamType: 'webcam',
      webcamEnabled: false,
      screenEnabled: false,
      viewerCount: 0
    })
    setCurrentSession(undefined)
    
    console.log('✅ Stream stopped successfully')
  }

  const handleToggleWebcam = async () => {
    if (!streamState.isLive) return

    try {
      if (streamState.webcamEnabled) {
        // Disable webcam - stop and remove webcam tracks
        if (webcamStreamRef.current) {
          stopMediaStream(webcamStreamRef.current)
          webcamStreamRef.current = null
        }
        
        // Remove webcam tracks from main stream
        if (streamRef.current) {
          const videoTracks = streamRef.current.getVideoTracks()
          videoTracks.forEach(track => {
            if (track.label.toLowerCase().includes('camera') || track.label.toLowerCase().includes('webcam')) {
              track.stop()
              streamRef.current?.removeTrack(track)
            }
          })
        }
        
        setStreamState(prev => ({ ...prev, webcamEnabled: false }))
      } else {
        // Enable webcam - add webcam stream
        const webcamStream = await getUserMediaStream('webcam')
        webcamStreamRef.current = webcamStream
        
        const videoTracks = webcamStream.getVideoTracks()
        const audioTracks = webcamStream.getAudioTracks()
        
        if (streamRef.current) {
          [...videoTracks, ...audioTracks].forEach(track => {
            streamRef.current?.addTrack(track)
          })
        }
        
        setStreamState(prev => ({ ...prev, webcamEnabled: true }))
      }
    } catch (error) {
      console.error('❌ Error toggling webcam:', error)
      setStreamState(prev => ({
        ...prev,
        error: 'Failed to toggle webcam. Please check camera permissions.'
      }))
    }
  }

  const handleToggleScreen = async () => {
    if (!streamState.isLive) return

    try {
      if (streamState.screenEnabled) {
        // Disable screen share - stop and remove screen tracks
        if (screenStreamRef.current) {
          stopMediaStream(screenStreamRef.current)
          screenStreamRef.current = null
        }
        
        // Remove screen tracks from main stream
        if (streamRef.current) {
          const videoTracks = streamRef.current.getVideoTracks()
          videoTracks.forEach(track => {
            if (!track.label.toLowerCase().includes('camera') && !track.label.toLowerCase().includes('webcam')) {
              track.stop()
              streamRef.current?.removeTrack(track)
            }
          })
        }
        
        setStreamState(prev => ({ ...prev, screenEnabled: false }))
      } else {
        // Enable screen share - add screen stream
        const screenStream = await getUserMediaStream('screen')
        screenStreamRef.current = screenStream
        
        const videoTracks = screenStream.getVideoTracks()
        const audioTracks = screenStream.getAudioTracks()
        
        if (streamRef.current) {
          [...videoTracks, ...audioTracks].forEach(track => {
            streamRef.current?.addTrack(track)
          })
        }
        
        setStreamState(prev => ({ ...prev, screenEnabled: true }))
      }
    } catch (error) {
      console.error('❌ Error toggling screen share:', error)
      setStreamState(prev => ({
        ...prev,
        error: 'Failed to toggle screen share. Please try again.'
      }))
    }
  }

  if (!webrtcSupported) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            WebRTC Not Supported
          </h3>
          <p className="text-gray-600 mb-4">
            Your browser doesn't support WebRTC. Please use a modern browser like Chrome, Firefox, or Safari.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
        
        {streamState.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-red-800 text-sm font-medium">{streamState.error}</p>
                {streamState.error.includes('refresh') && (
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 text-sm text-red-600 underline hover:text-red-800"
                  >
                    Refresh Page Now
                  </button>
                )}
                {streamState.error.includes('connection') && !streamState.error.includes('refresh') && (
                  <button
                    onClick={initializeConnection}
                    className="mt-2 text-sm text-red-600 underline hover:text-red-800"
                  >
                    Try Reconnecting
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Connection Status */}
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Streaming Server:</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionState === 'connected' ? 'bg-green-500' : 
                connectionState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
                'bg-red-500'
              }`}></div>
              <span className={`text-sm font-medium ${
                connectionState === 'connected' ? 'text-green-600' : 
                connectionState === 'connecting' ? 'text-yellow-600' : 
                'text-red-600'
              }`}>
                {connectionState === 'connected' ? 'Connected' : 
                 connectionState === 'connecting' ? 'Connecting...' : 
                 'Disconnected'}
              </span>
            </div>
          </div>
          {socketManager.getSocketId() && (
            <div className="mt-1 text-xs text-gray-500">
              Socket ID: {socketManager.getSocketId()}
            </div>
          )}
        </div>
      </div>

      {/* Stream Preview */}
      {streamRef.current && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Preview</h2>
          <StreamPreview stream={streamRef.current} />
        </div>
      )}

      {/* Stream Stats */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Stream Statistics</h2>
        <StreamStats
          session={currentSession}
          isLive={streamState.isLive}
          viewerCount={streamState.viewerCount}
        />
      </div>
    </div>
  )
}