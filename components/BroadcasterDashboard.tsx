'use client'

import { useState, useEffect, useRef } from 'react'
import { StreamState, StreamType, StreamSession } from '@/types'
import StreamControls from '@/components/StreamControls'
import StreamPreview from '@/components/StreamPreview'
import StreamStats from '@/components/StreamStats'
import { socketManager } from '@/lib/socket'
import { 
  checkWebRTCSupport, 
  getUserMediaStream, 
  createPeerConnection, 
  createOffer, 
  stopMediaStream, 
  combineStreams,
  getMediaDevices,
  testNetworkConnectivity
} from '@/lib/webrtc'

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
  const [systemCheck, setSystemCheck] = useState<{
    devices: any;
    network: any;
    permissions: string[];
  } | null>(null)
  
  const streamRef = useRef<MediaStream | null>(null)
  const webcamStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const connectionRetryRef = useRef<NodeJS.Timeout | null>(null)
  const systemCheckRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Initialize system checks
    initializeSystem()

    return () => {
      if (connectionRetryRef.current) {
        clearTimeout(connectionRetryRef.current)
      }
      if (systemCheckRef.current) {
        clearTimeout(systemCheckRef.current)
      }
      socketManager.disconnect()
      cleanupStreams()
    }
  }, [])

  const initializeSystem = async () => {
    console.log('🔧 Initializing broadcaster system...')
    
    // Check WebRTC support
    const webrtcOk = checkWebRTCSupport()
    setWebrtcSupported(webrtcOk)
    
    if (!webrtcOk) {
      setStreamState(prev => ({
        ...prev,
        error: 'WebRTC is not supported in your browser. Please use Chrome, Firefox, or Safari.'
      }))
      return
    }

    // Run system checks
    await runSystemChecks()
    
    // Initialize connection
    await initializeConnection()
  }

  const runSystemChecks = async () => {
    try {
      console.log('🔍 Running system checks...')
      
      const [deviceInfo, networkInfo] = await Promise.all([
        getMediaDevices(),
        testNetworkConnectivity()
      ])

      const permissions: string[] = []
      if (deviceInfo.permissions.camera === 'denied') permissions.push('Camera access denied')
      if (deviceInfo.permissions.microphone === 'denied') permissions.push('Microphone access denied')
      if (!deviceInfo.hasCamera) permissions.push('No camera device found')
      if (!deviceInfo.hasMicrophone) permissions.push('No microphone device found')
      if (!networkInfo.online) permissions.push('Network connection offline')
      if (networkInfo.latency > 5000) permissions.push('High network latency detected')

      setSystemCheck({
        devices: deviceInfo,
        network: networkInfo,
        permissions
      })

      console.log('✅ System checks completed')
    } catch (error) {
      console.error('❌ System checks failed:', error)
    }
  }

  const initializeConnection = async () => {
    try {
      console.log('🔌 Initializing streaming server connection...')
      setConnectionState('connecting')
      setStreamState(prev => ({ ...prev, error: undefined }))
      
      const socket = socketManager.connect()
      
      // Monitor connection state
      const checkConnection = () => {
        const state = socketManager.getConnectionState()
        setConnectionState(state)
        
        if (state === 'connected') {
          console.log('✅ Successfully connected to streaming server')
          setupSocketEventListeners()
          setStreamState(prev => ({ ...prev, error: undefined }))
        } else if (state === 'fallback') {
          console.log('⚠️ Using fallback mode - limited functionality')
          setupSocketEventListeners()
          setStreamState(prev => ({ 
            ...prev, 
            error: 'Using offline mode - streams will work locally but won\'t be visible to remote viewers'
          }))
        } else if (state === 'disconnected' && !socketManager.isConnected()) {
          console.log('❌ Connection failed, retrying in 5 seconds...')
          setStreamState(prev => ({
            ...prev,
            error: 'Connection to streaming server lost. Retrying automatically...'
          }))
          
          // Retry connection after 5 seconds
          connectionRetryRef.current = setTimeout(() => {
            initializeConnection()
          }, 5000)
        }
      }

      // Check connection status immediately and then every 3 seconds
      checkConnection()
      const connectionInterval = setInterval(checkConnection, 3000)

      // Clean up interval after 30 seconds
      setTimeout(() => {
        clearInterval(connectionInterval)
      }, 30000)

    } catch (error) {
      console.error('❌ Failed to initialize streaming server connection:', error)
      setConnectionState('disconnected')
      setStreamState(prev => ({
        ...prev,
        error: 'Failed to connect to streaming server. Check your internet connection or try refreshing the page.'
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
        title: `Live Stream - ${new Date().toLocaleString()}`,
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
        error: 'WebRTC is not supported in your browser. Please use a modern browser.'
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
          throw new Error('Failed to access both camera and screen. Please check permissions and try again.')
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
          errorMessage += 'Please allow camera and microphone permissions in your browser settings.'
        } else if (error.message.includes('timeout')) {
          errorMessage += 'Server connection timeout. Please check your internet connection and try again.'
        } else if (error.message.includes('not connected') || error.message.includes('Not connected')) {
          errorMessage += 'Connection to streaming server lost. Please refresh the page.'
        } else if (error.message.includes('NotFoundError')) {
          errorMessage += 'Camera or microphone not found. Please check your devices.'
        } else if (error.message.includes('NotReadableError')) {
          errorMessage += 'Camera or microphone is in use by another application.'
        } else {
          errorMessage += error.message
        }
      } else {
        errorMessage += 'Unknown error occurred. Please try again or refresh the page.'
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
        error: 'Failed to toggle webcam. Please check camera permissions and try again.'
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
        error: 'Failed to toggle screen share. Please check permissions and try again.'
      }))
    }
  }

  const handleRetryConnection = () => {
    initializeConnection()
  }

  const handleRunSystemCheck = () => {
    runSystemChecks()
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
            Your browser doesn't support WebRTC streaming. Please use a modern browser like Chrome, Firefox, Safari, or Edge.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* System Status */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">System Status</h2>
          <button
            onClick={handleRunSystemCheck}
            className="btn btn-sm btn-outline"
          >
            Run Check
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Connection Status */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Streaming Server</span>
              <div className={`w-2 h-2 rounded-full ${
                connectionState === 'connected' ? 'bg-green-500' : 
                connectionState === 'fallback' ? 'bg-yellow-500' :
                connectionState === 'connecting' ? 'bg-blue-500 animate-pulse' : 
                'bg-red-500'
              }`}></div>
            </div>
            <div className="text-sm">
              <span className={`font-medium ${
                connectionState === 'connected' ? 'text-green-600' : 
                connectionState === 'fallback' ? 'text-yellow-600' :
                connectionState === 'connecting' ? 'text-blue-600' : 
                'text-red-600'
              }`}>
                {connectionState === 'connected' ? 'Connected' : 
                 connectionState === 'fallback' ? 'Offline Mode' :
                 connectionState === 'connecting' ? 'Connecting...' : 
                 'Disconnected'}
              </span>
              {socketManager.isFallbackMode() && (
                <div className="text-xs text-yellow-600 mt-1">
                  Limited functionality - refresh to retry
                </div>
              )}
            </div>
          </div>

          {/* Device Status */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Devices</span>
              <div className={`w-2 h-2 rounded-full ${
                systemCheck?.devices?.hasCamera && systemCheck?.devices?.hasMicrophone ? 'bg-green-500' : 
                systemCheck?.devices?.hasCamera || systemCheck?.devices?.hasMicrophone ? 'bg-yellow-500' :
                'bg-red-500'
              }`}></div>
            </div>
            <div className="text-sm">
              {systemCheck?.devices ? (
                <div className="space-y-1">
                  <div className={systemCheck.devices.hasCamera ? 'text-green-600' : 'text-red-600'}>
                    📹 Camera: {systemCheck.devices.hasCamera ? 'Available' : 'Not found'}
                  </div>
                  <div className={systemCheck.devices.hasMicrophone ? 'text-green-600' : 'text-red-600'}>
                    🎤 Microphone: {systemCheck.devices.hasMicrophone ? 'Available' : 'Not found'}
                  </div>
                </div>
              ) : (
                <span className="text-gray-500">Checking...</span>
              )}
            </div>
          </div>

          {/* Network Status */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Network</span>
              <div className={`w-2 h-2 rounded-full ${
                systemCheck?.network?.online && systemCheck?.network?.latency < 1000 ? 'bg-green-500' : 
                systemCheck?.network?.online ? 'bg-yellow-500' :
                'bg-red-500'
              }`}></div>
            </div>
            <div className="text-sm">
              {systemCheck?.network ? (
                <div className="space-y-1">
                  <div className={systemCheck.network.online ? 'text-green-600' : 'text-red-600'}>
                    🌐 Status: {systemCheck.network.online ? 'Online' : 'Offline'}
                  </div>
                  {systemCheck.network.latency > 0 && (
                    <div className={systemCheck.network.latency < 500 ? 'text-green-600' : 
                                   systemCheck.network.latency < 1000 ? 'text-yellow-600' : 'text-red-600'}>
                      ⚡ Latency: {systemCheck.network.latency}ms
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-gray-500">Checking...</span>
              )}
            </div>
          </div>
        </div>

        {/* System Issues */}
        {systemCheck?.permissions && systemCheck.permissions.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">System Issues Detected:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              {systemCheck.permissions.map((issue, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">⚠️</span>
                  {issue}
                </li>
              ))}
            </ul>
          </div>
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
        
        {streamState.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-red-800 text-sm font-medium">{streamState.error}</p>
                <div className="mt-2 space-x-2">
                  {streamState.error.includes('refresh') && (
                    <button
                      onClick={() => window.location.reload()}
                      className="text-sm text-red-600 underline hover:text-red-800"
                    >
                      Refresh Page
                    </button>
                  )}
                  {streamState.error.includes('connection') && !streamState.error.includes('refresh') && (
                    <button
                      onClick={handleRetryConnection}
                      className="text-sm text-red-600 underline hover:text-red-800"
                    >
                      Retry Connection
                    </button>
                  )}
                  {streamState.error.includes('permissions') && (
                    <button
                      onClick={handleRunSystemCheck}
                      className="text-sm text-red-600 underline hover:text-red-800"
                    >
                      Check System
                    </button>
                  )}
                </div>
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
          session={currentSession}
          isLive={streamState.isLive}
          viewerCount={streamState.viewerCount}
        />
      </div>
    </div>
  )
}