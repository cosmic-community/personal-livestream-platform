'use client'

import { useState, useEffect, useRef } from 'react'
import { StreamState, StreamType, StreamSession } from '@/types'
import StreamControls from '@/components/StreamControls'
import StreamPreview from '@/components/StreamPreview'
import StreamStats from '@/components/StreamStats'
import { socketManager } from '@/lib/socket'
import { checkWebRTCSupport, getUserMediaStream, createPeerConnection, createOffer, stopMediaStream } from '@/lib/webrtc'

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
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())

  useEffect(() => {
    // Check WebRTC support
    setWebrtcSupported(checkWebRTCSupport())

    // Connect socket
    const socket = socketManager.connect()

    // Setup socket event listeners
    socketManager.onStreamStarted((data) => {
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
      handleStopStream()
    })

    socketManager.onViewerCount((count) => {
      setStreamState(prev => ({ ...prev, viewerCount: count }))
    })

    socketManager.onStreamAnswer(async (answer) => {
      // Handle viewer answers (simplified for this demo)
      console.log('Received viewer answer:', answer)
    })

    socketManager.onIceCandidate(async (candidate) => {
      // Handle ICE candidates from viewers
      console.log('Received ICE candidate:', candidate)
    })

    socketManager.onStreamError((error) => {
      setStreamState(prev => ({
        ...prev,
        error,
        isConnecting: false,
        isLive: false
      }))
    })

    return () => {
      socketManager.disconnect()
      if (streamRef.current) {
        stopMediaStream(streamRef.current)
      }
      // Close all peer connections
      peerConnectionsRef.current.forEach(pc => pc.close())
      peerConnectionsRef.current.clear()
    }
  }, [])

  const handleStartStream = async (streamType: StreamType) => {
    if (!webrtcSupported) {
      setStreamState(prev => ({
        ...prev,
        error: 'WebRTC is not supported in your browser'
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
      // Get media stream
      const stream = await getUserMediaStream(streamType === 'both' ? 'webcam' : streamType)
      streamRef.current = stream

      // Start socket broadcast
      socketManager.startBroadcast(streamType)

      // Update stream state
      setStreamState(prev => ({
        ...prev,
        webcamEnabled: streamType === 'webcam' || streamType === 'both',
        screenEnabled: streamType === 'screen' || streamType === 'both'
      }))

    } catch (error) {
      console.error('Error starting stream:', error)
      setStreamState(prev => ({
        ...prev,
        error: 'Failed to start stream. Please check camera/microphone permissions.',
        isConnecting: false
      }))
    }
  }

  const handleStopStream = () => {
    // Stop socket broadcast
    socketManager.stopBroadcast()

    // Stop media stream
    if (streamRef.current) {
      stopMediaStream(streamRef.current)
      streamRef.current = null
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach(pc => pc.close())
    peerConnectionsRef.current.clear()

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
        // Disable webcam - remove video tracks
        if (streamRef.current) {
          const videoTracks = streamRef.current.getVideoTracks()
          videoTracks.forEach(track => {
            if (track.label.includes('camera')) {
              track.stop()
              streamRef.current?.removeTrack(track)
            }
          })
        }
        setStreamState(prev => ({ ...prev, webcamEnabled: false }))
      } else {
        // Enable webcam - add video tracks
        const webcamStream = await getUserMediaStream('webcam')
        const videoTracks = webcamStream.getVideoTracks()
        
        if (streamRef.current) {
          videoTracks.forEach(track => {
            streamRef.current?.addTrack(track)
          })
        }
        setStreamState(prev => ({ ...prev, webcamEnabled: true }))
      }
    } catch (error) {
      console.error('Error toggling webcam:', error)
      setStreamState(prev => ({
        ...prev,
        error: 'Failed to toggle webcam'
      }))
    }
  }

  const handleToggleScreen = async () => {
    if (!streamState.isLive) return

    try {
      if (streamState.screenEnabled) {
        // Disable screen share - remove screen tracks
        if (streamRef.current) {
          const videoTracks = streamRef.current.getVideoTracks()
          videoTracks.forEach(track => {
            if (!track.label.includes('camera')) {
              track.stop()
              streamRef.current?.removeTrack(track)
            }
          })
        }
        setStreamState(prev => ({ ...prev, screenEnabled: false }))
      } else {
        // Enable screen share - add screen tracks
        const screenStream = await getUserMediaStream('screen')
        const videoTracks = screenStream.getVideoTracks()
        
        if (streamRef.current) {
          videoTracks.forEach(track => {
            streamRef.current?.addTrack(track)
          })
        }
        setStreamState(prev => ({ ...prev, screenEnabled: true }))
      }
    } catch (error) {
      console.error('Error toggling screen share:', error)
      setStreamState(prev => ({
        ...prev,
        error: 'Failed to toggle screen share'
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
            <p className="text-red-800 text-sm">{streamState.error}</p>
          </div>
        )}
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