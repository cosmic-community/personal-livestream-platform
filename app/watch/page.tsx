'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import MuxLivePlayer from '@/components/MuxLivePlayer'
import StreamViewer from '@/components/StreamViewer'

function WatchContent() {
  const searchParams = useSearchParams()
  const playbackId = searchParams.get('id')
  const streamId = searchParams.get('stream')
  const mode = searchParams.get('mode') || 'mux' // 'mux' or 'webrtc'
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [viewerCount, setViewerCount] = useState(0)

  useEffect(() => {
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading stream...</p>
        </div>
      </div>
    )
  }

  if (!playbackId && !streamId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">No Stream Found</h1>
          <p className="text-gray-600 mb-6">
            Please provide a valid stream ID or playback ID to watch a stream.
          </p>
          <div className="text-sm text-gray-500">
            <p>Example URLs:</p>
            <p className="font-mono bg-gray-100 p-2 rounded mt-2">
              /watch?id=PLAYBACK_ID (for Mux streams)
            </p>
            <p className="font-mono bg-gray-100 p-2 rounded mt-2">
              /watch?stream=SESSION_ID&mode=webrtc (for WebRTC streams)
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Live Stream</h1>
                <p className="text-gray-600 mt-1">
                  {mode === 'mux' ? 'Professional Mux Stream' : 'WebRTC P2P Stream'}
                </p>
              </div>
              
              {viewerCount > 0 && (
                <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 shadow">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">{viewerCount} watching</span>
                </div>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-red-800 font-medium">Stream Error</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                  <button
                    onClick={() => setError('')}
                    className="text-red-600 underline text-sm mt-2 hover:text-red-800"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Video Player */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {mode === 'mux' && playbackId ? (
                  <MuxLivePlayer
                    playbackId={playbackId}
                    streamTitle="Live Stream"
                    autoPlay={true}
                    muted={false}
                    showViewerCount={true}
                    onViewerCountUpdate={(count) => setViewerCount(count)}
                    onStreamStart={() => console.log('Stream started')}
                    onStreamEnd={() => console.log('Stream ended')}
                    className="aspect-video"
                  />
                ) : streamId ? (
                  <StreamViewer
                    streamId={streamId}
                    className="aspect-video"
                    onViewerCountChange={(count) => setViewerCount(count)}
                    onError={(err) => setError(err)}
                  />
                ) : (
                  <div className="aspect-video bg-gray-900 flex items-center justify-center">
                    <div className="text-center text-white">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                      <p className="text-lg font-semibold">No Stream Available</p>
                      <p className="text-sm text-gray-300 mt-2">Check the stream URL and try again</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Stream Info */}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3">Stream Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mode:</span>
                    <span className="font-medium capitalize">{mode}</span>
                  </div>
                  {playbackId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Playback ID:</span>
                      <code className="text-xs bg-gray-100 px-1 rounded">
                        {playbackId.substring(0, 8)}...
                      </code>
                    </div>
                  )}
                  {streamId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stream ID:</span>
                      <code className="text-xs bg-gray-100 px-1 rounded">
                        {streamId.substring(0, 8)}...
                      </code>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Viewers:</span>
                    <span className="font-medium">{viewerCount}</span>
                  </div>
                </div>
              </div>

              {/* Share Stream */}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3">Share Stream</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href)
                      alert('Stream URL copied to clipboard!')
                    }}
                    className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                  >
                    Copy Stream Link
                  </button>
                  
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: 'Watch Live Stream',
                          text: 'Join me for a live stream!',
                          url: window.location.href
                        })
                      } else {
                        navigator.clipboard.writeText(window.location.href)
                        alert('Stream URL copied to clipboard!')
                      }
                    }}
                    className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
                  >
                    Share Stream
                  </button>
                </div>
              </div>

              {/* Quality Info */}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3">Stream Quality</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Resolution:</span>
                    <span className="font-medium">Auto</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Latency:</span>
                    <span className="font-medium">
                      {mode === 'mux' ? 'Low' : 'Ultra-Low'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Protocol:</span>
                    <span className="font-medium">
                      {mode === 'mux' ? 'HLS' : 'WebRTC'}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading stream...</p>
        </div>
      </div>
    }>
      <WatchContent />
    </Suspense>
  )
}