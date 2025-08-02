export const STREAM_CONFIG = {
  // Try the NEXT_PUBLIC_WS_URL first, otherwise fall back to localhost for dev
  SERVER_URLS: [
    process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
  ],
  CONNECTION: {
    timeout: 5000,
    maxRetries: 5,
    maxUrlAttempts: 3,
    reconnectBackoff: [500, 1000, 2000],
    heartbeatInterval: 30000
  },
  FALLBACK: {
    enableBroadcastChannel: true,
    enableP2P: true,
    enableLocalStorage: true,
    p2pSignalingTimeout: 15000,
    fallbackReconnectInterval: 30000,
    maxFallbackDuration: 300000, // 5 minutes
    enableMockMode: process.env.NODE_ENV === 'development' // Enable mock mode in development
  },
  WEBRTC: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'balanced' as RTCBundlePolicy,
    rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy
  },
  MEDIA: {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  },
  DEBUG: process.env.NODE_ENV === 'development'
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export const log = (level: LogLevel, message: string, ...args: any[]) => {
  if (!STREAM_CONFIG.DEBUG && level === 'debug') return
  
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [STREAM-${level.toUpperCase()}]`
  
  switch (level) {
    case 'error':
      console.error(prefix, message, ...args)
      break
    case 'warn':
      console.warn(prefix, message, ...args)
      break
    case 'debug':
      console.debug(prefix, message, ...args)
      break
    default:
      console.log(prefix, message, ...args)
  }
}

// Export WebRTC configuration getter
export const getWebRTCConfig = (): RTCConfiguration => {
  return {
    iceServers: STREAM_CONFIG.WEBRTC.iceServers,
    iceCandidatePoolSize: STREAM_CONFIG.WEBRTC.iceCandidatePoolSize,
    bundlePolicy: STREAM_CONFIG.WEBRTC.bundlePolicy,
    rtcpMuxPolicy: STREAM_CONFIG.WEBRTC.rtcpMuxPolicy
  }
}

// Create stream error helper function
export const createStreamError = (message: string, code?: string, details?: any): Error => {
  const error = new Error(message)
  if (code) {
    (error as any).code = code
  }
  if (details) {
    (error as any).details = details
  }
  return error
}

// Connection method testing interface
interface ConnectionMethods {
  websocket: boolean
  broadcastChannel: boolean
  localStorage: boolean
  webrtc: boolean
}

// Test all available connection methods
export const testAllConnectionMethods = async (): Promise<ConnectionMethods> => {
  const results: ConnectionMethods = {
    websocket: false,
    broadcastChannel: false,
    localStorage: false,
    webrtc: false
  }

  // Test WebSocket support
  try {
    if (typeof WebSocket !== 'undefined') {
      results.websocket = true
      log('debug', '✅ WebSocket support available')
    }
  } catch (error) {
    log('debug', '❌ WebSocket support not available', error)
  }

  // Test BroadcastChannel support
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const testChannel = new BroadcastChannel('test-support')
      testChannel.close()
      results.broadcastChannel = true
      log('debug', '✅ BroadcastChannel support available')
    }
  } catch (error) {
    log('debug', '❌ BroadcastChannel support not available', error)
  }

  // Test localStorage support
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('test-support', 'test')
      localStorage.removeItem('test-support')
      results.localStorage = true
      log('debug', '✅ localStorage support available')
    }
  } catch (error) {
    log('debug', '❌ localStorage support not available', error)
  }

  // Test WebRTC support
  try {
    if (typeof RTCPeerConnection !== 'undefined') {
      const testPC = new RTCPeerConnection()
      testPC.close()
      results.webrtc = true
      log('debug', '✅ WebRTC support available')
    }
  } catch (error) {
    log('debug', '❌ WebRTC support not available', error)
  }

  log('info', '🔍 Connection method test results:', results)
  return results
}