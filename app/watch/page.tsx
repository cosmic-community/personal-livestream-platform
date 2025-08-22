'use client'

import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

// Dynamically import MuxLivePlayer to avoid SSR issues
const MuxLivePlayer = dynamic(() => import('@/components/MuxLivePlayer'), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-lg font-semibold">Loading player...</p>
      </div>
    </div>
  )
})

// Create a separate component for the search params logic
function WatchContent() {
  const searchParams = useSearchParams()
  const [playbackId, setPlaybackId] = useState<string>('')
  const [customPlaybackId, setCustomPlaybackId] = useState<string>('')
  const [streamStatus, setStreamStatus] = useState<'unknown' | 'live' | 'offline'>('unknown')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    // Get playback ID from URL parameter
    const urlPlaybackId = searchParams?.get('playback_id') || searchParams?.get('p') || ''
    if (urlPlaybackId) {
      setPlaybackId(urlPlaybackId)
      setCustomPlaybackId(urlPlaybackId)
    }
  }, [searchParams])

  const handlePlaybackIdSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (customPlaybackId.trim()) {
      setPlaybackId(customPlaybackId.trim())
      setError('')
      
      // Update URL with playback ID
      const url = new URL(window.location.href)
      url.searchParams.set('playback_id', customPlaybackId.trim())
      window.history.replaceState({}, '', url.toString())
    }
  }

  const handleStreamStart = () => {
    setStreamStatus('live')
  }

  const handleStreamEnd = () => {
    setStreamStatus('offline')
  }

  const handlePlayerError = (errorMessage: string) => {
    setError(errorMessage)
    setStreamStatus('offline')
  }

  const copyWatchUrl = async () => {
    if (!playbackId) return
    
    const watchUrl = `${window.location.origin}/watch?playback_id=${playbackId}`
    try {
      await navigator.clipboard.writeText(watchUrl)
      console.log('✅ Watch URL copied to clipboard')
    } catch (err) {
      console.error('❌ Failed to copy watch URL')
    }
  }

  return (
    <>
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Live Stream Viewer</h1>
              <p className="text-gray-600 mt-1">Watch live streams powered by Mux</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {playbackId && (
                <button
                  onClick={copyWatchUrl}
                  className="btn btn-secondary"
                >
                  Share Stream
                </button>
              )}
              
              <a href="/" className="btn btn-primary">
                Create Stream
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!playbackId ? (
          /* Playback ID Input Form */
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Playback ID</h2>
                <p className="text-gray-600">
                  Enter the playback ID provided by the streamer to watch their live stream
                </p>
              </div>

              <form onSubmit={handlePlaybackIdSubmit} className="space-y-4">
                <div>
                  <label htmlFor="playbackId" className="block text-sm font-medium text-gray-700 mb-2">
                    Playback ID
                  </label>
                  <input
                    type="text"
                    id="playbackId"
                    value={customPlaybackId}
                    onChange={(e) => setCustomPlaybackId(e.target.value)}
                    placeholder="e.g., abc123def456ghi789"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    The playback ID is provided by the stream creator and looks like a random string of letters and numbers
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!customPlaybackId.trim()}
                  className="w-full btn btn-primary disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Watch Stream
                </button>
              </form>

              <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">How to get a Playback ID:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Ask the streamer for their playback ID</li>
                  <li>• Look for it in the stream dashboard under "Playback Information"</li>
                  <li>• It's different from the stream key (which should stay private)</li>
                  <li>• Playback IDs are safe to share publicly</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* Live Stream Player */
          <div className="space-y-6">
            {/* Stream Info Header */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <h2 className="text-xl font-semibold">Live Stream</h2>
                    <p className="text-gray-600">Playback ID: {playbackId.substring(0, 8)}...</p>
                  </div>
                  
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    streamStatus === 'live' 
                      ? 'bg-red-100 text-red-800' 
                      : streamStatus === 'offline'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {streamStatus === 'live' ? '🔴 LIVE' : 
                     streamStatus === 'offline' ? '⚫ OFFLINE' : 
                     '🟡 CHECKING...'}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={copyWatchUrl}
                    className="btn btn-sm btn-secondary"
                  >
                    Copy URL
                  </button>
                  
                  <button
                    onClick={() => {
                      setPlaybackId('')
                      setCustomPlaybackId('')
                      setError('')
                      setStreamStatus('unknown')
                      // Clear URL parameter
                      const url = new URL(window.location.href)
                      url.searchParams.delete('playback_id')
                      window.history.replaceState({}, '', url.toString())
                    }}
                    className="btn btn-sm btn-secondary"
                  >
                    Change Stream
                  </button>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-red-800 font-medium">Stream Error</h3>
                    <p className="text-red-700 text-sm mt-1">{error}</p>
                    <p className="text-red-600 text-xs mt-2">
                      The stream may be offline, the playback ID may be incorrect, or there may be a network issue.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Video Player */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="aspect-video bg-black">
                <MuxLivePlayer
                  playbackId={playbackId}
                  streamTitle="Live Stream"
                  autoPlay={true}
                  muted={false}
                  controls={true}
                  accentColor="#3b82f6"
                  showViewerCount={true}
                  onStreamStart={handleStreamStart}
                  onStreamEnd={handleStreamEnd}
                  onError={handlePlayerError}
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Stream Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">
                      {streamStatus === 'live' ? 'LIVE' : 'OFFLINE'}
                    </p>
                    <p className="text-gray-600">Status</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">HD</p>
                    <p className="text-gray-600">Quality</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">Low</p>
                    <p className="text-gray-600">Latency</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Viewer Tips */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-4">💡 Viewer Tips</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                <div>
                  <h4 className="font-medium mb-2">Video Controls:</h4>
                  <ul className="space-y-1">
                    <li>• Click the video to play/pause</li>
                    <li>• Use spacebar for play/pause</li>
                    <li>• Adjust volume with up/down arrows</li>
                    <li>• Press 'F' for fullscreen</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Connection Issues:</h4>
                  <ul className="space-y-1">
                    <li>• Refresh the page if stream freezes</li>
                    <li>• Check your internet connection</li>
                    <li>• Try a different browser if problems persist</li>
                    <li>• Contact the streamer if stream appears offline</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}

// Loading component for Suspense fallback
function WatchPageLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Live Stream Viewer</h1>
              <p className="text-gray-600 mt-1">Watch live streams powered by Mux</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <a href="/" className="btn btn-primary">
                Create Stream
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg font-semibold text-gray-900">Loading stream viewer...</p>
              <p className="text-gray-600 text-sm mt-1">Please wait while we prepare your streaming experience</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// Main component with Suspense boundary
export default function WatchPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<WatchPageLoading />}>
        <WatchContent />
      </Suspense>
    </div>
  )
}