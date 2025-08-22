import MuxVideoPlayer from '@/components/MuxVideoPlayer'

export default function WatchPage() {
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
                Playback ID
              </label>
              <input
                type="text"
                placeholder="Enter Mux playback ID..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Load Stream
            </button>
          </div>
        </div>
        
        <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video">
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
        </div>
        
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">How to Watch</h3>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Get a Mux playback ID from your streaming dashboard</li>
            <li>2. Paste it into the input field above</li>
            <li>3. Click "Load Stream" to start watching</li>
            <li>4. The video will automatically start playing when the stream goes live</li>
          </ol>
        </div>
      </div>
    </main>
  )
}