'use client'

import { useState, useEffect } from 'react'
import { useMux } from '@/hooks/useMux'
import { getMuxStreamingService } from '@/lib/mux-streaming'

interface MuxStream {
  id: string
  streamKey: string
  playbackIds: Array<{ id: string; policy: string }>
  status: string
  rtmpUrl: string
  hlsUrl?: string
  isLive: boolean
  createdAt: string
}

export default function MuxStreamingDashboard() {
  const {
    streams,
    activeStream,
    isLoading,
    error,
    createStream,
    deleteStream,
    refreshStreams,
    clearError
  } = useMux()

  const [streamingInstructions, setStreamingInstructions] = useState<{
    rtmpUrl: string
    streamKey: string
    software: {
      obs: { server: string; streamKey: string }
      streamlabs: { server: string; streamKey: string }
    }
  } | null>(null)

  const [playbackInfo, setPlaybackInfo] = useState<{
    hlsUrl?: string
    thumbnailUrl?: string
    isLive: boolean
  } | null>(null)

  const muxStreaming = getMuxStreamingService()

  useEffect(() => {
    refreshStreams()
  }, [refreshStreams])

  useEffect(() => {
    if (activeStream) {
      loadStreamingInstructions()
      loadPlaybackInfo()
    }
  }, [activeStream])

  const loadStreamingInstructions = async () => {
    if (!activeStream) return
    
    try {
      const instructions = await muxStreaming.getStreamingInstructions(activeStream.id)
      setStreamingInstructions(instructions)
    } catch (error) {
      console.error('Failed to load streaming instructions:', error)
    }
  }

  const loadPlaybackInfo = async () => {
    if (!activeStream) return
    
    try {
      const playback = await muxStreaming.getPlaybackInfo(activeStream.id)
      setPlaybackInfo(playback)
    } catch (error) {
      console.error('Failed to load playback info:', error)
    }
  }

  const handleCreateStream = async () => {
    try {
      const stream = await createStream({
        playbackPolicy: 'public',
        reducedLatency: true,
        reconnectWindow: 60,
        newAssetSettings: {
          playbackPolicy: 'public',
          mp4Support: 'capped-1080p',
          normalizeAudio: true
        }
      })
      
      console.log('✅ New Mux stream created:', stream.id)
    } catch (error) {
      console.error('❌ Failed to create stream:', error)
    }
  }

  const handleDeleteStream = async (streamId: string) => {
    if (!confirm('Are you sure you want to delete this stream? This action cannot be undone.')) {
      return
    }
    
    try {
      await deleteStream(streamId)
      console.log('✅ Stream deleted successfully')
    } catch (error) {
      console.error('❌ Failed to delete stream:', error)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here
      console.log('✅ Copied to clipboard')
    } catch (error) {
      console.error('❌ Failed to copy to clipboard:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Mux Streaming Dashboard</h1>
          <p className="text-gray-600">Manage your live streams with Mux Video</p>
        </div>
        
        <button
          onClick={handleCreateStream}
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? 'Creating...' : 'Create New Stream'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-red-800 text-sm font-medium">{error}</p>
              <button
                onClick={clearError}
                className="text-sm text-red-600 underline hover:text-red-800 mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Stream Details */}
      {activeStream && (
        <div className="card">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold">Active Stream</h2>
              <p className="text-sm text-gray-600">Stream ID: {activeStream.id}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`px-2 py-1 rounded text-sm font-medium ${
                activeStream.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : activeStream.status === 'idle'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {activeStream.status}
              </div>
              
              <button
                onClick={() => handleDeleteStream(activeStream.id)}
                className="btn btn-sm btn-danger"
              >
                Delete Stream
              </button>
            </div>
          </div>

          {/* Streaming Instructions */}
          {streamingInstructions && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Streaming Setup</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">OBS Studio</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="text-sm text-gray-600">Server:</label>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-2 py-1 rounded text-sm flex-1">
                          {streamingInstructions.software.obs.server}
                        </code>
                        <button
                          onClick={() => copyToClipboard(streamingInstructions.software.obs.server)}
                          className="btn btn-xs btn-secondary"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Stream Key:</label>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-2 py-1 rounded text-sm flex-1 font-mono">
                          {streamingInstructions.software.obs.streamKey.substring(0, 20)}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(streamingInstructions.software.obs.streamKey)}
                          className="btn btn-xs btn-secondary"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Streamlabs</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="text-sm text-gray-600">Server:</label>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-2 py-1 rounded text-sm flex-1">
                          {streamingInstructions.software.streamlabs.server}
                        </code>
                        <button
                          onClick={() => copyToClipboard(streamingInstructions.software.streamlabs.server)}
                          className="btn btn-xs btn-secondary"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Stream Key:</label>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-2 py-1 rounded text-sm flex-1 font-mono">
                          {streamingInstructions.software.streamlabs.streamKey.substring(0, 20)}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(streamingInstructions.software.streamlabs.streamKey)}
                          className="btn btn-xs btn-secondary"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Playback Information */}
          {playbackInfo && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Playback Information</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 w-24">Status:</span>
                  <div className={`px-2 py-1 rounded text-sm font-medium ${
                    playbackInfo.isLive 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {playbackInfo.isLive ? 'LIVE' : 'OFFLINE'}
                  </div>
                </div>
                
                {playbackInfo.hlsUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 w-24">HLS URL:</span>
                    <code className="bg-gray-50 px-2 py-1 rounded text-sm flex-1">
                      {playbackInfo.hlsUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(playbackInfo.hlsUrl || '')}
                      className="btn btn-xs btn-secondary"
                    >
                      Copy
                    </button>
                  </div>
                )}
                
                {playbackInfo.thumbnailUrl && (
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-gray-600 w-24 mt-1">Thumbnail:</span>
                    <div className="flex-1">
                      <img
                        src={playbackInfo.thumbnailUrl}
                        alt="Stream thumbnail"
                        className="w-48 h-27 object-cover rounded border"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stream Statistics */}
          <div>
            <h3 className="font-semibold mb-3">Stream Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold">
                  {activeStream.playbackIds.length}
                </div>
                <div className="text-sm text-gray-600">Playback IDs</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold">
                  {activeStream.status === 'active' ? 'LIVE' : 'OFFLINE'}
                </div>
                <div className="text-sm text-gray-600">Stream Status</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold">
                  {new Date(activeStream.createdAt).toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-600">Created</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold">Public</div>
                <div className="text-sm text-gray-600">Playback Policy</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Streams List */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">All Streams</h2>
          <button
            onClick={refreshStreams}
            disabled={isLoading}
            className="btn btn-sm btn-secondary"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {streams.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No streams found</p>
            <button
              onClick={handleCreateStream}
              disabled={isLoading}
              className="btn btn-primary"
            >
              Create Your First Stream
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {streams.map((stream) => (
              <div
                key={stream.id}
                className={`p-4 border rounded-lg ${
                  activeStream?.id === stream.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">Stream {stream.id.substring(0, 8)}</h3>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        stream.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : stream.status === 'idle'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {stream.status}
                      </div>
                      {activeStream?.id === stream.id && (
                        <div className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Active
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      Created: {new Date(stream.createdAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      Playback IDs: {stream.playbackIds.length}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteStream(stream.id)}
                    className="btn btn-sm btn-danger ml-4"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Getting Started Guide */}
      {streams.length === 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Getting Started with Mux Streaming</h2>
          
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                1
              </div>
              <div>
                <h3 className="font-medium">Create a Stream</h3>
                <p className="text-sm text-gray-600">Click "Create New Stream" to generate your streaming endpoint and playback URLs.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                2
              </div>
              <div>
                <h3 className="font-medium">Configure Your Software</h3>
                <p className="text-sm text-gray-600">Use the provided RTMP URL and stream key in OBS Studio, Streamlabs, or any RTMP-compatible software.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                3
              </div>
              <div>
                <h3 className="font-medium">Start Broadcasting</h3>
                <p className="text-sm text-gray-600">Start your stream in your broadcasting software, and viewers can watch using the HLS playback URL.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}