export const STREAM_CONFIG = {
  // WebRTC Configuration
  WEBRTC: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle' as RTCBundlePolicy,
    rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
  },

  // Server URLs for fallback
  SERVER_URLS: [
    'ws://localhost:3001',
    'wss://your-websocket-server.com',
  ],

  // Connection settings
  CONNECTION: {
    timeout: 10000,
    maxRetries: 5,
    maxUrlAttempts: 3,
    reconnectBackoff: [1000, 2000, 5000, 10000, 15000],
    heartbeatInterval: 30000,
    healthCheckInterval: 15000, // Added missing property
  },

  // Stream quality settings
  QUALITY: {
    video: {
      low: { width: 640, height: 480, frameRate: 15, bitrate: 500000 },
      medium: { width: 1280, height: 720, frameRate: 30, bitrate: 1500000 },
      high: { width: 1920, height: 1080, frameRate: 30, bitrate: 3000000 },
    },
    audio: {
      bitrate: 128000,
      sampleRate: 44100,
    },
  },

  // Media constraints
  CONSTRAINTS: {
    video: {
      width: { ideal: 1280, max: 1920, min: 640 },
      height: { ideal: 720, max: 1080, min: 480 },
      frameRate: { ideal: 30, max: 60, min: 15 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  },
}

// Logging utility
export const log = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`
  
  if (data) {
    console[level](logMessage, data)
  } else {
    console[level](logMessage)
  }
}

// Error creation utility
export const createStreamError = (code: string, message: string, details?: any) => {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    details,
    browserInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
    },
  }
}

// Test connection methods
export const testAllConnectionMethods = async () => {
  const methods = {
    websocket: false,
    webrtc: false,
    broadcastChannel: false,
    localStorage: false,
  }

  // Test WebSocket
  try {
    const testWs = new WebSocket('wss://echo.websocket.org')
    methods.websocket = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000)
      testWs.onopen = () => {
        clearTimeout(timeout)
        testWs.close()
        resolve(true)
      }
      testWs.onerror = () => {
        clearTimeout(timeout)
        resolve(false)
      }
    })
  } catch {
    methods.websocket = false
  }

  // Test WebRTC
  try {
    const pc = new RTCPeerConnection()
    pc.close()
    methods.webrtc = true
  } catch {
    methods.webrtc = false
  }

  // Test BroadcastChannel
  try {
    if ('BroadcastChannel' in window) {
      const testChannel = new BroadcastChannel('test')
      testChannel.close()
      methods.broadcastChannel = true
    }
  } catch {
    methods.broadcastChannel = false
  }

  // Test localStorage
  try {
    localStorage.setItem('test', 'test')
    localStorage.removeItem('test')
    methods.localStorage = true
  } catch {
    methods.localStorage = false
  }

  return methods
}