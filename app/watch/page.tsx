'use client'

import { useState } from 'react'
import MuxVideoPlayer from '@/components/MuxVideoPlayer'
import MuxLivePlayer from '@/components/MuxLivePlayer'

export default function WatchPage() {
  const [playbackId, setPlaybackId] = useState('')
  const [streamType, setStreamType] = useState<'live' | 'vod'>('live')
  const [isPlayerReady, setIsPlayerReady] = useState(false)

  const handleLoadStream = () => {
    if (playbackId.trim()) {
      setIsPlayerReady(true)
    }
  }

  const handleClearStream = () => {
    setPlaybackId('')
    setIsPlayerReady(false)
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Live Stream Viewer</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Watch Live Stream</h2>
          <p className="text-gray-600 mb-4">
            Enter a Mux playback ID to watch a live stream or recorded video.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stream Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="streamType"
                    value="live"
                    checked={streamType === 'live'}
                    onChange={(e) => setStreamType(e.target.value as 'live' | 'vod')}
                    className="mr-2"
                  />
                  Live Stream
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="streamType"
                    value="vod"
                    checked={streamType === 'vod'}
                    onChange={(e) => setStreamType(e.target.value as 'live' | 'vod')}
                    className="mr-2"
                  />
                  Video on Demand
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Playback ID
              </label>
              <input
                type="text"
                value={playbackId}
                onChange={(e) => setPlaybackId(e.target.value)}
                placeholder="Enter Mux playback ID..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleLoadStream}
                disabled={!playbackId.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Load Stream
              </button>
              
              {isPlayerReady && (
                <button
                  onClick={handleClearStream}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video">
          {isPlayerReady && playbackId ? (
            streamType === 'live' ? (
              <MuxLivePlayer
                playbackId={playbackId}
                streamTitle="Live Stream"
                autoPlay={true}
                muted={false}
                accentColor="#3b82f6"
                showViewerCount={true}
                onStreamStart={() => console.log('🟢 Live stream started')}
                onStreamEnd={() => console.log('🔴 Live stream ended')}
                onViewerCountUpdate={(count) => console.log(`👥 Viewers: ${count}`)}
              />
            ) : (
              <MuxVideoPlayer
                playbackId={playbackId}
                title="Video on Demand"
                autoPlay={false}
                muted={false}
                controls={true}
                accentColor="#3b82f6"
                onLoadStart={() => console.log('📡 VOD loading started')}
                onPlay={() => console.log('▶️ VOD playback started')}
                onPause={() => console.log('⏸️ VOD paused')}
                onEnded={() => console.log('🏁 VOD ended')}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                <p className="text-lg font-semibold">No Stream Selected</p>
                <p className="text-sm text-gray-400">Enter a playback ID above to start watching</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Example Playback IDs for Testing */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">How to Watch</h3>
          <ol className="text-sm text-blue-800 space-y-1 mb-4">
            <li>1. Get a Mux playback ID from your streaming dashboard</li>
            <li>2. Choose the appropriate stream type (Live or VOD)</li>
            <li>3. Paste the playback ID into the input field above</li>
            <li>4. Click "Load Stream" to start watching</li>
            <li>5. For live streams, the video will show "LIVE" when broadcasting</li>
          </ol>
          
          <div className="mt-4 p-3 bg-white rounded border">
            <h4 className="font-medium text-blue-900 mb-2">Example Mux Demo Stream</h4>
            <p className="text-sm text-gray-600 mb-2">
              You can test with this public Mux demo stream:
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1 font-mono">
                EcHgOK9coz5K4rjSwOkoE7Y7O01201YMIC200RI6lNxnhs
              </code>
              <button
                onClick={() => {
                  setPlaybackId('EcHgOK9coz5K4rjSwOkoE7Y7O01201YMIC200RI6lNxnhs')
                  setStreamType('vod')
                  setIsPlayerReady(true)
                }}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Load Demo
              </button>
            </div>
          </div>
        </div>

        {/* Stream Information */}
        {isPlayerReady && playbackId && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Stream Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Playback ID:</p>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded block break-all">
                  {playbackId}
                </code>
              </div>
              <div>
                <p className="text-sm text-gray-600">Stream Type:</p>
                <p className="text-sm font-medium capitalize">{streamType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Player:</p>
                <p className="text-sm font-medium">Mux Player React</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Features:</p>
                <p className="text-sm font-medium">
                  {streamType === 'live' 
                    ? 'Live streaming, viewer count, auto-retry' 
                    : 'VOD playback, seek controls, quality selection'
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}