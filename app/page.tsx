import BroadcasterDashboard from '@/components/BroadcasterDashboard'
import StreamHistory from '@/components/StreamHistory'
import { getRecentStreamSessions } from '@/lib/cosmic'
import { StreamSession } from '@/types'

export default async function HomePage() {
  let recentSessions: StreamSession[] = []
  
  try {
    recentSessions = await getRecentStreamSessions(5)
  } catch (error) {
    console.error('Error loading recent sessions:', error)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Personal Livestream Platform
          </h1>
          <p className="text-lg text-gray-600">
            Start broadcasting instantly with webcam or screen share
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Broadcasting Controls */}
          <div className="lg:col-span-2">
            <BroadcasterDashboard />
          </div>

          {/* Stream History Sidebar */}
          <div className="lg:col-span-1">
            <StreamHistory sessions={recentSessions} />
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="card max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-4">Getting Started</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">For Broadcasters</h4>
                <ul className="space-y-1 text-left">
                  <li>• Click "Go Live" to start streaming</li>
                  <li>• Choose webcam or screen sharing</li>
                  <li>• Toggle sources during your stream</li>
                  <li>• Monitor viewer count in real-time</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">For Viewers</h4>
                <ul className="space-y-1 text-left">
                  <li>• Visit <code className="bg-gray-100 px-1 rounded">/watch</code> to view streams</li>
                  <li>• No account or login required</li>
                  <li>• Streams auto-start when available</li>
                  <li>• Real-time connection with low latency</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}