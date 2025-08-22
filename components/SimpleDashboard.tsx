'use client'

import { useState, useEffect, useRef } from 'react'
import { StreamingCore } from '@/lib/streaming-core'
import { StreamState, StreamType, StreamError, createStreamState } from '@/types'

export default function SimpleDashboard() {
  const [streamState, setStreamState] = useState<StreamState>(() => createStreamState({
    isLive: false,
    isConnecting: false,
    streamType: 'webcam',
    webcamEnabled: false,
    screenEnabled: false,
    viewerCount: 0
  }))
  
  const [error, setError] = useState<StreamError | null>(null)
  const [streamingCore] = useState(() => new StreamingCore({ debug: true }))
  const [isInitialized, setIsInitialized] = useState(false)
  const [shareableUrl, setShareableUrl] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const initialize = async () => {
      try {
        const isSupported = await streamingCore.initialize()
        if (!isSupported) {
          throw new Error('WebRTC not supported in this browser')
        }

        // Set up event listeners
        streamingCore.onStateChange((state: StreamState) => {
          setStreamState(prevState => ({
            ...prevState,
            ...state
          }))
          
          // Update video element with new stream
          if (state.mediaStream && videoRef.current) {
            videoRef.current.srcObject = state.mediaStream
            videoRef.current.play().catch(console.error)
          }
        })

        streamingCore.onError((err: StreamError) => {
          setError(err)
        })

        // Connect to signaling server
        await streamingCore.connect()
        setIsInitialized(true)

      } catch (err) {
        setError({
          code: 'INIT_FAILED',
          message: err instanceof Error ? err.message : 'Failed to initialize',
          timestamp: new Date().toISOString()
        })
      }
    }

    initialize()

    return () => {
      streamingCore.destroy()
    }
  }, [streamingCore])

  // Generate shareable URL when stream starts
  useEffect(() => {
    if (streamState.isLive && streamState.sessionId) {
      const baseUrl = window.location.origin
      const streamUrl = `${baseUrl}/watch?stream=${streamState.sessionId}&mode=webrtc`
      setShareableUrl(streamUrl)
    } else {
      setShareableUrl('')
    }
  }, [streamState.isLive, streamState.sessionId])

  const handleStartStream = async (type: StreamType) => {
    try {
      setError(null)
      await streamingCore.startStream(type)
    } catch (err) {
      setError({
        code: 'STREAM_START_FAILED',
        message: err instanceof Error ? err.message : 'Failed to start stream',
        timestamp: new Date().toISOString()
      })
    }
  }

  const handleStopStream = async () => {
    try {
      await streamingCore.stopStream()
      setError(null)
      setShareableUrl('')
    } catch (err) {
      setError({
        code: 'STREAM_STOP_FAILED',
        message: err instanceof Error ? err.message : 'Failed to stop stream',
        timestamp: new Date().toISOString()
      })
    }
  }

  const handleToggleWebcam = async () => {
    try {
      await streamingCore.toggleWebcam()
    } catch (err) {
      setError({
        code: 'WEBCAM_TOGGLE_FAILED',
        message: err instanceof Error ? err.message : 'Failed to toggle webcam',
        timestamp: new Date().toISOString()
      })
    }
  }

  const handleToggleScreen = async () => {
    try {
      await streamingCore.toggleScreen()
    } catch (err) {
      setError({
        code: 'SCREEN_TOGGLE_FAILED',
        message: err instanceof Error ? err.message : 'Failed to toggle screen share',
        timestamp: new Date().toISOString()
      })
    }
  }

  const copyStreamUrl = async () => {
    if (shareableUrl) {
      try {
        await navigator.clipboard.writeText(shareableUrl)
        alert('Stream URL copied to clipboard!')
      } catch (err) {
        console.error('Failed to copy URL:', err)
        // Fallback
        prompt('Copy this URL to share your stream:', shareableUrl)
      }
    }
  }

  const shareStream = async () => {
    if (!shareableUrl) return

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Watch my live stream!',
          text: 'Join me for a live stream',
          url: shareableUrl
        })
      } catch (err) {
        console.error('Share failed:', err)
        copyStreamUrl()
      }
    } else {
      copyStreamUrl()
    }
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing streaming...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Personal Livestream Platform</h1>
          
          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-red-800 font-medium">{error.code}</p>
                  <p className="text-red-600 text-sm mt-1">{error.message}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-600 underline text-sm mt-2 hover:text-red-800"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Stream Controls */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Stream Controls</h2>
              
              <div className="space-y-4">
                {/* Stream Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      streamState.isLive ? 'bg-red-500 animate-pulse' :
                      streamState.isConnecting ? 'bg-yellow-500 animate-pulse' :
                      'bg-gray-400'
                    }`}></div>
                    <span className="text-sm font-medium">
                      {streamState.isLive ? 'LIVE' : streamState.isConnecting ? 'CONNECTING' : 'OFFLINE'}
                    </span>
                    {streamState.viewerCount > 0 && (
                      <span className="text-sm text-gray-600">
                        {streamState.viewerCount} viewers
                      </span>
                    )}
                  </div>
                  
                  {/* Share Button */}
                  {streamState.isLive && shareableUrl && (
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                    >
                      Share Stream
                    </button>
                  )}
                </div>

                {/* Stream Type Selection */}
                {!streamState.isLive && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Start Streaming:</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleStartStream('webcam')}
                        disabled={streamState.isConnecting}
                        className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
                      >
                        📷 Webcam
                      </button>
                      <button
                        onClick={() => handleStartStream('screen')}
                        disabled={streamState.isConnecting}
                        className="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                      >
                        🖥️ Screen
                      </button>
                      <button
                        onClick={() => handleStartStream('both')}
                        disabled={streamState.isConnecting}
                        className="px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 transition-colors"
                      >
                        📹 Both
                      </button>
                    </div>
                  </div>
                )}

                {/* Live Controls */}
                {streamState.isLive && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={handleToggleWebcam}
                        className={`px-4 py-2 text-sm rounded transition-colors ${
                          streamState.webcamEnabled 
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        📷 {streamState.webcamEnabled ? 'Webcam On' : 'Webcam Off'}
                      </button>
                      <button
                        onClick={handleToggleScreen}
                        className={`px-4 py-2 text-sm rounded transition-colors ${
                          streamState.screenEnabled 
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        🖥️ {streamState.screenEnabled ? 'Screen On' : 'Screen Off'}
                      </button>
                    </div>
                    
                    <button
                      onClick={handleStopStream}
                      className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      🛑 Stop Stream
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Stream Preview */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Stream Preview</h2>
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
                <video
                  ref={videoRef}
                  muted
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                {/* Live Badge */}
                {streamState.isLive && (
                  <div className="absolute top-4 left-4">
                    <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      LIVE
                    </span>
                  </div>
                )}

                {/* Viewer Count */}
                {streamState.viewerCount > 0 && (
                  <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
                    <span className="text-sm">{streamState.viewerCount} watching</span>
                  </div>
                )}

                {/* Placeholder when not streaming */}
                {!streamState.mediaStream && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                      <p className="text-lg font-semibold">No Stream Preview</p>
                      <p className="text-sm mt-1">Start streaming to see preview</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stream Information */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Stream Information</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{streamState.viewerCount}</div>
                  <div className="text-sm text-gray-600">Current Viewers</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {streamState.isLive ? 'LIVE' : 'OFFLINE'}
                  </div>
                  <div className="text-sm text-gray-600">Stream Status</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 capitalize">{streamState.streamType}</div>
                  <div className="text-sm text-gray-600">Stream Type</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {new Date(streamState.lastUpdated).toLocaleTimeString()}
                  </div>
                  <div className="text-sm text-gray-600">Last Update</div>
                </div>
              </div>

              {/* Viewer Link */}
              {shareableUrl && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">📡 Share Your Stream</h3>
                  <p className="text-sm text-blue-800 mb-3">
                    Copy this link to share with viewers:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white px-3 py-2 rounded text-sm font-mono border">
                      {shareableUrl}
                    </code>
                    <button
                      onClick={copyStreamUrl}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Share Stream</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Stream URL:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareableUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border rounded text-sm font-mono bg-gray-50"
                  />
                  <button
                    onClick={copyStreamUrl}
                    className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={shareStream}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                >
                  📱 Share
                </button>
                <button
                  onClick={() => {
                    window.open(`https://twitter.com/intent/tweet?text=Watch%20my%20live%20stream!&url=${encodeURIComponent(shareableUrl)}`, '_blank')
                  }}
                  className="px-4 py-2 bg-blue-400 text-white rounded hover:bg-blue-500 transition-colors"
                >
                  🐦
                </button>
                <button
                  onClick={() => {
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableUrl)}`, '_blank')
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  📘
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}