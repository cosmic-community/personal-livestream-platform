'use client'

import { useState, useEffect } from 'react'
import MuxLivePlayer from './MuxLivePlayer'

interface Stream {
  id: string
  streamKey: string
  playbackIds: Array<{ id: string; policy: string }>
  status: string
  rtmpUrl: string
  createdAt: string
}

export default function SimpleDashboard() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [activeStream, setActiveStream] = useState<Stream | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStreamKey, setShowStreamKey] = useState(false)

  useEffect(() => {
    loadStreams()
  }, [])

  const loadStreams = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/mux/streams')
      if (!response.ok) {
        throw new Error('Failed to load streams')
      }
      
      const streamsData = await response.json()
      setStreams(streamsData)
      
      if (streamsData.length > 0) {
        setActiveStream(streamsData[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load streams')
    } finally {
      setIsLoading(false)
    }
  }

  const createStream = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/mux/streams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playbackPolicy: 'public',
          reducedLatency: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create stream')
      }

      const newStream = await response.json()
      setStreams(prev => [newStream, ...prev])
      setActiveStream(newStream)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create stream')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteStream = async (streamId: string) => {
    if (!confirm('Are you sure you want to delete this stream?')) {
      return
    }

    try {
      const response = await fetch(`/api/mux/streams/${streamId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete stream')
      }

      setStreams(prev => prev.filter(s => s.id !== streamId))
      
      if (activeStream?.id === streamId) {
        // Fixed: Handle possibly undefined activeStream and streams array access
        const remainingStreams = streams.filter(s => s.id !== streamId)
        setActiveStream(remainingStreams.length > 0 ? remainingStreams[0] : null)
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete stream')
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Live Streaming Dashboard</h1>
          <p className="text-gray-600 mt-1">Create and manage your live streams</p>
        </div>
        <button
          onClick={createStream}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating...' : 'Create New Stream'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Stream List */}
      {streams.length === 0 && !isLoading ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No streams yet</h3>
          <p className="text-gray-600 mb-4">Create your first stream to get started</p>
          <button
            onClick={createStream}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
          >
            Create Stream
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stream Controls */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Stream Configuration</h2>
            
            {activeStream ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stream Status
                  </label>
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                    activeStream.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {activeStream.status}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RTMP Server
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value="rtmps://global-live.mux.com:443/live"
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard("rtmps://global-live.mux.com:443/live")}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stream Key
                    <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Private</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showStreamKey ? "text" : "password"}
                      value={activeStream.streamKey}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                    />
                    <button
                      onClick={() => setShowStreamKey(!showStreamKey)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
                    >
                      {showStreamKey ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => copyToClipboard(activeStream.streamKey)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    ⚠️ Keep this key private - anyone with it can stream to your channel
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <button
                    onClick={() => deleteStream(activeStream.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Delete Stream
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No active stream selected</p>
                <button
                  onClick={createStream}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Create Stream
                </button>
              </div>
            )}
          </div>

          {/* Live Preview */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
            
            {/* Fixed: Add proper null checks for activeStream and playbackIds */}
            {activeStream && activeStream.playbackIds && activeStream.playbackIds.length > 0 ? (
              <div className="space-y-4">
                <MuxLivePlayer
                  playbackId={activeStream.playbackIds[0].id}
                  streamTitle="Live Stream"
                  autoPlay={false}
                  muted={true}
                  className="w-full aspect-video"
                />
                <p className="text-sm text-gray-600">
                  Playback ID: {activeStream.playbackIds[0].id}
                </p>
              </div>
            ) : (
              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm">Stream preview will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* All Streams */}
      {streams.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">All Streams</h2>
          
          <div className="space-y-3">
            {streams.map((stream) => (
              <div
                key={stream.id}
                className={`p-4 border rounded-lg cursor-pointer ${
                  activeStream?.id === stream.id 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setActiveStream(stream)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      Stream {stream.id.substring(0, 8)}...
                    </h3>
                    <p className="text-sm text-gray-600">
                      Created: {new Date(stream.createdAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      Playback IDs: {stream.playbackIds.length}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      stream.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {stream.status}
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteStream(stream.id)
                      }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}