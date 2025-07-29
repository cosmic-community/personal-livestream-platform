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
  const streamRef = useRef<MediaStream | null>(null)
  const webcamStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())

  useEffect(() => {
    // Check WebRTC support
    setWebrtcSupported(checkWebRTCSupport())

    // Connect socket
    try {
      const socket = socketManager.connect()
      console.log('Socket connection initiated')

      // Setup socket event listeners
      socketManager.onStreamStarted((data) => {
        console.log('Stream started event received:', data)
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
          sessionId: data.sessionId
        }))
      })

      socketManager.onStreamEnded((data) => {
        console.log('Stream ended event received:', data)
        handleStopStream()
      })

      socketManager.onViewerCount((count) => {
        setStreamState(prev => ({ ...prev, viewerCount: count }))
      })

      socketManager.onStreamError((error) => {
        console.error('Stream error received:', error)
        setStreamState(prev => ({
          ...prev,
          error: error.message || 'Stream error occurred',
          isConnecting: false,
          isLive: false
        }))
      })

    } catch (error) {
      console.error('Failed to initialize socket connection:', error)
      setStreamState(prev => ({
        ...prev,
        error: 'Failed to connect to streaming server. Please try again.',
        isConnecting: false
      }))
    }

    return () => {
      socketManager.disconnect()
      cleanupStreams()
    }
  }, [])

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
        error: 'Not connected to streaming server. Please refresh the page.',
        isConnecting: false
      }))
      return
    }

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
        const [webcamStream, screenStream] = await Promise.all([
          getUserMediaStream('webcam').catch(err => {
            console.warn('Webcam access failed:', err)
            return null
          }),
          getUserMediaStream('screen').catch(err => {
            console.warn('Screen access failed:', err)
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
        finalStream = await getUserMediaStream(streamType)
        
        if (streamType === 'webcam') {
          webcamStreamRef.current = finalStream
        } else {
          screenStreamRef.current = finalStream
        }
      }

      streamRef.current = finalStream

      // Start socket broadcast and wait for confirmation
      await socketManager.startBroadcast(streamType)

      // Update stream state after successful socket broadcast
      setStreamState(prev => ({
        ...prev,
        webcamEnabled: streamType === 'webcam' || streamType === 'both',
        screenEnabled: streamType === 'screen' || streamType === 'both'
      }))

      console.log('Stream started successfully')

    } catch (error) {
      console.error('Error starting stream:', error)
      
      // Clean up any partially created streams
      cleanupStreams()

      let errorMessage = 'Failed to start stream. '
      
      if (error instanceof Error) {
        if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
          errorMessage += 'Please grant camera and microphone permissions.'
        } else if (error.message.includes('timeout')) {
          errorMessage += 'Server connection timeout. Please try again.'
        } else if (error.message.includes('not connected')) {
          errorMessage += 'Connection to streaming server lost. Please refresh the page.'
        } else {
          errorMessage += error.message
        }
      } else {
        errorMessage += 'Unknown error occurred.'
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
      console.error('Error toggling webcam:', error)
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
      console.error('Error toggling screen share:', error)
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
              <p className="text-red-800 text-sm">{streamState.error}</p>
            </div>
          </div>
        )}

        {/* Socket Connection Status */}
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Server Connection:</span>
            <span className={`text-sm font-medium ${
              socketManager.isConnected() ? 'text-green-600' : 'text-red-600'
            }`}>
              {socketManager.isConnected() ? 'Connected' : 'Disconnected'}
            </span>
          </div>
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