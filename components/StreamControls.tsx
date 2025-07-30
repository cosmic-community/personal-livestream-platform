import { StreamState, StreamType } from '@/types'

interface StreamControlsProps {
  streamState: StreamState
  onStartStream: (type: StreamType) => Promise<void>
  onStopStream: () => void
  onToggleWebcam: () => Promise<void>
  onToggleScreen: () => Promise<void>
}

export default function StreamControls({
  streamState,
  onStartStream,
  onStopStream,
  onToggleWebcam,
  onToggleScreen
}: StreamControlsProps) {
  const handleStreamTypeChange = async (type: StreamType) => {
    if (!streamState.isLive && !streamState.isConnecting) {
      try {
        await onStartStream(type)
      } catch (error) {
        console.error('Failed to start stream:', error)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Main Stream Control */}
      <div className="flex items-center justify-center">
        {!streamState.isLive && !streamState.isConnecting ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => handleStreamTypeChange('webcam')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
                disabled={streamState.isConnecting}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                Start Webcam Stream
              </button>
              
              <button
                onClick={() => handleStreamTypeChange('screen')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
                disabled={streamState.isConnecting}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 8V5h12v7H4z" clipRule="evenodd" />
                </svg>
                Start Screen Share
              </button>
            </div>
            
            <div className="text-center">
              <button
                onClick={() => handleStreamTypeChange('both')}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors"
                disabled={streamState.isConnecting}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                Start Both (Webcam + Screen)
              </button>
            </div>
          </div>
        ) : streamState.isConnecting ? (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Starting stream...</p>
            <p className="text-sm text-gray-500 mt-2">
              Please allow camera/microphone permissions if prompted
            </p>
          </div>
        ) : (
          <button
            onClick={onStopStream}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg font-medium flex items-center gap-3 transition-colors animate-pulse"
          >
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <span className="text-lg">LIVE - Stop Stream</span>
          </button>
        )}
      </div>

      {/* Stream Source Toggles */}
      {streamState.isLive && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium mb-4">Source Controls</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={onToggleWebcam}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                streamState.webcamEnabled 
                  ? 'bg-green-100 text-green-800 border border-green-300' 
                  : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
              {streamState.webcamEnabled ? 'Webcam On' : 'Webcam Off'}
            </button>
            
            <button
              onClick={onToggleScreen}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                streamState.screenEnabled 
                  ? 'bg-green-100 text-green-800 border border-green-300' 
                  : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 8V5h12v7H4z" clipRule="evenodd" />
              </svg>
              {streamState.screenEnabled ? 'Screen On' : 'Screen Off'}
            </button>
          </div>
        </div>
      )}

      {/* Stream Status */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              streamState.isLive ? 'bg-red-100 text-red-800' : 
              streamState.isConnecting ? 'bg-yellow-100 text-yellow-800' : 
              'bg-gray-100 text-gray-600'
            }`}>
              {streamState.isLive ? 'LIVE' : 
               streamState.isConnecting ? 'CONNECTING' : 
               'OFFLINE'}
            </span>
            {streamState.isLive && (
              <span className="text-sm text-gray-600">
                {streamState.viewerCount} viewer{streamState.viewerCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {streamState.isLive && (
            <div className="text-sm text-gray-600">
              Stream Type: {streamState.streamType}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}