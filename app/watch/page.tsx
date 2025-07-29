import StreamViewer from '@/components/StreamViewer'
import { getCurrentLiveSession } from '@/lib/cosmic'

export default async function WatchPage() {
  let currentSession = null
  
  try {
    currentSession = await getCurrentLiveSession()
  } catch (error) {
    console.error('Error checking for live session:', error)
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Live Stream
          </h1>
          <p className="text-gray-400">
            {currentSession ? 'Stream is currently live' : 'No stream currently active'}
          </p>
        </header>

        <div className="max-w-6xl mx-auto">
          <StreamViewer initialSession={currentSession} />
        </div>

        {/* Instructions for when no stream is active */}
        {!currentSession && (
          <div className="mt-8 text-center">
            <div className="card bg-gray-800 border-gray-700 max-w-md mx-auto">
              <div className="text-gray-300">
                <h3 className="text-lg font-semibold mb-4 text-white">
                  No Stream Active
                </h3>
                <p className="mb-4">
                  The broadcaster is currently offline. This page will automatically 
                  connect when a stream becomes available.
                </p>
                <div className="flex items-center justify-center">
                  <div className="loading-spinner"></div>
                  <span className="ml-2 text-sm">Waiting for stream...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}