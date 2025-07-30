import { StreamingProvider } from '@/components/StreamingProvider'
import SimpleStreamBroadcaster from '@/components/SimpleStreamBroadcaster'

export default function Home() {
  return (
    <StreamingProvider 
      serverUrl="ws://localhost:3001"
      autoConnect={true}
      debug={true}
    >
      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Personal Live Streaming Platform
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Start broadcasting instantly with webcam, screen sharing, or both. 
              Built with WebRTC for high-quality, low-latency streaming.
            </p>
          </div>
          
          <SimpleStreamBroadcaster />
        </div>
      </main>
    </StreamingProvider>
  )
}