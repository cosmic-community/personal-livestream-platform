'use client'

import { useState } from 'react'
import { useMux } from '@/hooks/useMux'

interface StreamConfig {
  playbackPolicy: 'public' | 'signed'
  reducedLatency: boolean
  reconnectWindow: number
  newAssetSettings: {
    playbackPolicy: 'public' | 'signed'
    mp4Support: 'none' | 'capped-1080p' | 'standard'
    normalizeAudio: boolean
  }
  subtitleSettings?: {
    enabled: boolean
    languageCode: string
    name: string
  }
}

export default function UniqueStreamCreator() {
  const { createStream, isLoading, error } = useMux()
  const [config, setConfig] = useState<StreamConfig>({
    playbackPolicy: 'public',
    reducedLatency: true,
    reconnectWindow: 60,
    newAssetSettings: {
      playbackPolicy: 'public',
      mp4Support: 'capped-1080p',
      normalizeAudio: true
    },
    subtitleSettings: {
      enabled: true,
      languageCode: 'en',
      name: 'English (generated)'
    }
  })

  const [createdStream, setCreatedStream] = useState<any>(null)

  const handleCreateUniqueStream = async () => {
    try {
      console.log('🎯 Creating unique live stream with custom configuration...')
      
      const stream = await createStream(config)
      setCreatedStream(stream)
      
      console.log('✅ Unique stream created successfully:', stream.id)
    } catch (error) {
      console.error('❌ Failed to create unique stream:', error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-2">🎯 Unique Live Stream Creator</h2>
        <p className="opacity-90">
          Create a custom live stream with your unique Mux credentials and advanced configuration
        </p>
      </div>

      {/* Configuration Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stream Settings */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Stream Configuration</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Playback Policy
              </label>
              <select
                value={config.playbackPolicy}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  playbackPolicy: e.target.value as 'public' | 'signed' 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="public">Public</option>
                <option value="signed">Signed</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="reducedLatency"
                checked={config.reducedLatency}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  reducedLatency: e.target.checked 
                }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="reducedLatency" className="ml-2 block text-sm text-gray-700">
                Enable Reduced Latency
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reconnect Window (seconds)
              </label>
              <input
                type="number"
                value={config.reconnectWindow}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  reconnectWindow: parseInt(e.target.value) || 60 
                }))}
                min="10"
                max="300"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Asset Settings */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Asset Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                MP4 Support
              </label>
              <select
                value={config.newAssetSettings.mp4Support}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  newAssetSettings: {
                    ...prev.newAssetSettings,
                    mp4Support: e.target.value as 'none' | 'capped-1080p' | 'standard'
                  }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="capped-1080p">Capped 1080p</option>
                <option value="standard">Standard</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="normalizeAudio"
                checked={config.newAssetSettings.normalizeAudio}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  newAssetSettings: {
                    ...prev.newAssetSettings,
                    normalizeAudio: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="normalizeAudio" className="ml-2 block text-sm text-gray-700">
                Normalize Audio
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asset Playback Policy
              </label>
              <select
                value={config.newAssetSettings.playbackPolicy}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  newAssetSettings: {
                    ...prev.newAssetSettings,
                    playbackPolicy: e.target.value as 'public' | 'signed'
                  }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="public">Public</option>
                <option value="signed">Signed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Subtitle Configuration */}
      {config.subtitleSettings && (
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Subtitle Settings</h3>
            <input
              type="checkbox"
              id="subtitlesEnabled"
              checked={config.subtitleSettings.enabled}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                subtitleSettings: prev.subtitleSettings ? {
                  ...prev.subtitleSettings,
                  enabled: e.target.checked
                } : undefined
              }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>

          {config.subtitleSettings.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language Code
                </label>
                <select
                  value={config.subtitleSettings.languageCode}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    subtitleSettings: prev.subtitleSettings ? {
                      ...prev.subtitleSettings,
                      languageCode: e.target.value
                    } : undefined
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ru">Russian</option>
                  <option value="nl">Dutch</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subtitle Name
                </label>
                <input
                  type="text"
                  value={config.subtitleSettings.name}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    subtitleSettings: prev.subtitleSettings ? {
                      ...prev.subtitleSettings,
                      name: e.target.value
                    } : undefined
                  }))}
                  placeholder="e.g., English (generated)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Button */}
      <div className="text-center">
        <button
          onClick={handleCreateUniqueStream}
          disabled={isLoading}
          className={`px-8 py-4 rounded-lg font-medium text-white transition-colors ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Creating Unique Stream...
            </div>
          ) : (
            '🚀 Create Unique Live Stream'
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Created Stream Display */}
      {createdStream && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <svg className="w-6 h-6 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-semibold text-green-800">
              ✅ Unique Stream Created Successfully!
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stream ID:</label>
              <div className="flex items-center gap-2">
                <code className="bg-white px-3 py-2 rounded border text-sm flex-1">
                  {createdStream.id}
                </code>
                <button
                  onClick={() => copyToClipboard(createdStream.id)}
                  className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RTMP URL:</label>
              <div className="flex items-center gap-2">
                <code className="bg-white px-3 py-2 rounded border text-sm flex-1">
                  {createdStream.rtmpUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(createdStream.rtmpUrl)}
                  className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stream Key:</label>
              <div className="flex items-center gap-2">
                <code className="bg-white px-3 py-2 rounded border text-sm flex-1">
                  {createdStream.streamKey}
                </code>
                <button
                  onClick={() => copyToClipboard(createdStream.streamKey)}
                  className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Copy
                </button>
              </div>
            </div>

            {createdStream.playbackIds && createdStream.playbackIds.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Playback URL:</label>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-3 py-2 rounded border text-sm flex-1">
                    https://stream.mux.com/{createdStream.playbackIds[0]?.id}.m3u8
                  </code>
                  <button
                    onClick={() => copyToClipboard(`https://stream.mux.com/${createdStream.playbackIds[0]?.id}.m3u8`)}
                    className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">🎯 Your Unique Configuration:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Using your custom Mux credentials</li>
                <li>• Reduced Latency: {createdStream.reducedLatency ? 'Enabled' : 'Disabled'}</li>
                <li>• Playback Policy: {config.playbackPolicy}</li>
                <li>• MP4 Support: {config.newAssetSettings.mp4Support}</li>
                <li>• Audio Normalization: {config.newAssetSettings.normalizeAudio ? 'Enabled' : 'Disabled'}</li>
                {config.subtitleSettings?.enabled && (
                  <li>• Auto Subtitles: {config.subtitleSettings.languageCode.toUpperCase()}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}