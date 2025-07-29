import { StreamControlsProps, StreamType } from '@/types'

export default function StreamControls({
  streamState,
  onStartStream,
  onStopStream,
  onToggleWebcam,
  onToggleScreen
}: StreamControlsProps) {
  const handleStreamTypeChange = (type: StreamType) => {
    if (!streamState.isLive && !streamState.isConnecting) {
      onStartStream(type)
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
                className="btn btn-primary btn-lg flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                Go Live with Webcam
              </button>
              
              <button
                onClick={() => handleStreamTypeChange('screen')}
                className="btn btn-secondary btn-lg flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 8V5h12v7H4z" clipRule="evenodd" />
                </svg>
                Go Live with Screen
              </button>
            </div>
            
            <div className="text-center">
              <button
                onClick={() => handleStreamTypeChange('both')}
                className="btn btn-outline btn-lg flex items-center gap-2 mx-auto"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                Go Live with Both
              </button>
            </div>
          </div>
        ) : streamState.isConnecting ? (
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-gray-600">Starting stream...</p>
          </div>
        ) : (
          <button
            onClick={onStopStream}
            className="btn btn-primary btn-lg flex items-center gap-2 pulse-glow"
          >
            <div className="live-indicator"></div>
            Stop Stream
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
              className={`btn btn-md flex items-center gap-2 ${
                streamState.webcamEnabled ? 'btn-success' : 'btn-outline'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
              {streamState.webcamEnabled ? 'Webcam On' : 'Webcam Off'}
            </button>
            
            <button
              onClick={onToggleScreen}
              className={`btn btn-md flex items-center gap-2 ${
                streamState.screenEnabled ? 'btn-success' : 'btn-outline'
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
      <div className="bg-muted rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`status-badge ${
              streamState.isLive ? 'status-live' : 
              streamState.isConnecting ? 'status-connecting' : 
              'status-offline'
            }`}>
              {streamState.isLive ? 'LIVE' : 
               streamState.isConnecting ? 'CONNECTING' : 
               'OFFLINE'}
            </span>
            {streamState.isLive && (
              <span className="text-sm text-muted-foreground">
                {streamState.viewerCount} viewer{streamState.viewerCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {streamState.isLive && (
            <div className="text-sm text-muted-foreground">
              Stream Type: {streamState.streamType}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}