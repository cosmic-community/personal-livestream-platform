import MuxStreamingDashboard from '@/components/MuxStreamingDashboard'
import UniqueStreamCreator from '@/components/UniqueStreamCreator'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Personal Live Streaming Platform
              </h1>
              <p className="text-gray-600 mt-1">
                Powered by Mux Video - Professional live streaming infrastructure
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Built with Mux API
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" title="Service Active"></div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
            <h2 className="text-2xl font-bold mb-4">
              🎥 Welcome to Your Professional Streaming Platform
            </h2>
            <p className="text-lg opacity-90 mb-6">
              Create high-quality live streams with industry-leading infrastructure. 
              Stream to any RTMP-compatible software like OBS Studio, Streamlabs, or mobile apps.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <div className="text-2xl mb-2">🔒</div>
                <h3 className="font-semibold">Secure Streaming</h3>
                <p className="text-sm opacity-90">Private stream keys with enterprise security</p>
              </div>
              
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <div className="text-2xl mb-2">⚡</div>
                <h3 className="font-semibold">Low Latency</h3>
                <p className="text-sm opacity-90">Sub-second latency for real-time interaction</p>
              </div>
              
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <div className="text-2xl mb-2">📈</div>
                <h3 className="font-semibold">Analytics</h3>
                <p className="text-sm opacity-90">Comprehensive streaming metrics and insights</p>
              </div>
            </div>
          </div>

          {/* Unique Stream Creator */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">🚀 Custom Stream Creator</h2>
              <p className="text-gray-600 mt-1">
                Create a live stream with your unique Mux configuration
              </p>
            </div>
            <div className="p-6">
              <UniqueStreamCreator />
            </div>
          </div>

          {/* Main Dashboard */}
          <MuxStreamingDashboard />

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold ml-3">Professional Streaming</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Stream with OBS Studio, Streamlabs, XSplit, or any RTMP-compatible software. 
                Industry-standard protocols for reliable broadcasting.
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• RTMP/RTMPS protocol support</li>
                <li>• Hardware encoder compatibility</li>
                <li>• Mobile streaming apps</li>
                <li>• Custom streaming software integration</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold ml-3">Enterprise Security</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Your stream keys are treated as private credentials with enterprise-level security. 
                Monitor and control access to your broadcasts.
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• Encrypted stream key generation</li>
                <li>• One-click key reset functionality</li>
                <li>• Access monitoring and alerts</li>
                <li>• Secure key storage recommendations</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold ml-3">Global Infrastructure</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Powered by Mux's global CDN with 99.9% uptime SLA. 
                Low-latency streaming optimized for worldwide audiences.
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• Global edge network</li>
                <li>• Adaptive bitrate streaming</li>
                <li>• 99.9% uptime guarantee</li>
                <li>• Automatic failover protection</li>
              </ul>
            </div>
          </div>

          {/* Stream Key Security Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-amber-600 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-amber-800 font-semibold text-lg mb-2">
                  🔐 Important: Stream Key Security
                </h3>
                <div className="text-amber-700 space-y-2">
                  <p>
                    <strong>Your stream key is a private credential.</strong> Anyone with access to your stream key 
                    can broadcast to your live stream. Please follow these security best practices:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Never share your stream key in public channels, screenshots, or recordings</li>
                    <li>Store your stream key securely using a password manager or encrypted notes</li>
                    <li>If you suspect your stream key has been compromised, reset it immediately</li>
                    <li>Monitor your streaming dashboard for unexpected activity</li>
                    <li>Consider creating temporary streams for testing or demonstrations</li>
                  </ul>
                  <p className="font-medium">
                    💡 Tip: Use the "Reset Key" function if you need to invalidate the current key and generate a new one.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Getting Started Guide */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">🎯 Getting Started Guide</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-semibold text-lg mb-4">For OBS Studio Users:</h3>
                  <ol className="space-y-3 text-sm">
                    <li className="flex">
                      <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">1</span>
                      <span>Create a new live stream above to get your RTMP server and stream key</span>
                    </li>
                    <li className="flex">
                      <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">2</span>
                      <span>Open OBS Studio and go to Settings → Stream</span>
                    </li>
                    <li className="flex">
                      <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">3</span>
                      <span>Set Service to "Custom" and paste your Server URL</span>
                    </li>
                    <li className="flex">
                      <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">4</span>
                      <span>Paste your Stream Key (keep this private!)</span>
                    </li>
                    <li className="flex">
                      <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">5</span>
                      <span>Click "Start Streaming" to go live</span>
                    </li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-4">For Mobile Streaming:</h3>
                  <ol className="space-y-3 text-sm">
                    <li className="flex">
                      <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">1</span>
                      <span>Download a mobile streaming app (Streamlabs, Prism Live Studio, etc.)</span>
                    </li>
                    <li className="flex">
                      <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">2</span>
                      <span>Create your stream above and copy the RTMP URL</span>
                    </li>
                    <li className="flex">
                      <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">3</span>
                      <span>In your app, select "Custom RTMP" or "Other"</span>
                    </li>
                    <li className="flex">
                      <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">4</span>
                      <span>Enter your RTMP URL and Stream Key securely</span>
                    </li>
                    <li className="flex">
                      <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">5</span>
                      <span>Start broadcasting to your audience</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Personal Live Streaming Platform - Powered by Mux Video Infrastructure
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Professional streaming for everyone</span>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}