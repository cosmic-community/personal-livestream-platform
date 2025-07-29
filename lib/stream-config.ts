import { StreamType } from '@/types'

// Define the RTCSdpSemantics type if not available
declare global {
  type RTCSdpSemantics = 'plan-b' | 'unified-plan'
}

// Enhanced streaming configuration with multiple fallback options
export const STREAM_CONFIG = {
  // Server URLs in priority order
  SERVER_URLS: [
    process.env.NEXT_PUBLIC_SOCKET_URL,
    'ws://localhost:3001',
    'ws://127.0.0.1:3001',
    'ws://localhost:8080',
    'ws://127.0.0.1:8080'
  ].filter(Boolean) as string[],

  // Connection settings with more aggressive retry
  CONNECTION: {
    timeout: 8000, // 8 seconds
    maxRetries: 8, // More retries
    retryDelay: 1500, // Faster retries
    heartbeatInterval: 20000, // 20 seconds
    reconnectBackoff: [500, 1000, 2000, 3000, 5000], // Faster backoff
    healthCheckInterval: 15000, // More frequent checks
    maxUrlAttempts: 3 // Try each URL multiple times
  },

  // WebRTC configuration with more STUN servers
  WEBRTC: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun.stunprotocol.org:3478' }
    ],
    iceCandidatePoolSize: 15,
    bundlePolicy: 'max-bundle' as RTCBundlePolicy,
    rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
    iceTransportPolicy: 'all' as RTCIceTransportPolicy,
    sdpSemantics: 'unified-plan' as RTCSdpSemantics
  },

  // Optimized media constraints
  MEDIA_CONSTRAINTS: {
    webcam: {
      video: {
        width: { ideal: 1280, max: 1920, min: 640 },
        height: { ideal: 720, max: 1080, min: 480 },
        frameRate: { ideal: 30, max: 60, min: 15 },
        aspectRatio: { ideal: 16/9 },
        facingMode: 'user'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 44100 },
        channelCount: { ideal: 2 }
      }
    },
    screen: {
      video: {
        width: { ideal: 1920, max: 3840, min: 1280 },
        height: { ideal: 1080, max: 2160, min: 720 },
        frameRate: { ideal: 30, max: 60, min: 15 },
        cursor: 'always' as DisplayCaptureSurfaceType,
        displaySurface: 'monitor' as DisplayCaptureSurfaceType
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    },
    fallback: {
      video: {
        width: { ideal: 640, max: 1280, min: 320 },
        height: { ideal: 480, max: 720, min: 240 },
        frameRate: { ideal: 15, max: 30, min: 10 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
    }
  },

  // Stream quality settings
  QUALITY_SETTINGS: {
    high: {
      video: {
        width: 1920,
        height: 1080,
        frameRate: 30,
        bitrate: 2500000 // 2.5 Mbps
      },
      audio: {
        bitrate: 128000 // 128 kbps
      }
    },
    medium: {
      video: {
        width: 1280,
        height: 720,
        frameRate: 30,
        bitrate: 1500000 // 1.5 Mbps
      },
      audio: {
        bitrate: 96000 // 96 kbps
      }
    },
    low: {
      video: {
        width: 854,
        height: 480,
        frameRate: 24,
        bitrate: 800000 // 800 kbps
      },
      audio: {
        bitrate: 64000 // 64 kbps
      }
    }
  },

  // Error codes and messages
  ERROR_CODES: {
    CONNECTION_FAILED: 'CONNECTION_FAILED',
    WEBRTC_NOT_SUPPORTED: 'WEBRTC_NOT_SUPPORTED',
    MEDIA_ACCESS_DENIED: 'MEDIA_ACCESS_DENIED',
    STREAM_START_FAILED: 'STREAM_START_FAILED',
    PEER_CONNECTION_FAILED: 'PEER_CONNECTION_FAILED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE'
  },

  // Enhanced fallback behavior
  FALLBACK: {
    enableOfflineMode: true,
    enableP2PMode: true, // Enable direct peer-to-peer
    offlineModeTimeout: 10000, // 10 seconds
    mockViewerRange: [1, 12], // Wider range
    mockViewerUpdateInterval: 6000, // 6 seconds
    enableBroadcastChannel: true // Use BroadcastChannel API
  },

  // Development settings
  DEV: {
    enableDetailedLogging: process.env.NODE_ENV === 'development',
    logWebRTCStats: process.env.NODE_ENV === 'development',
    showConnectionDebugInfo: process.env.NODE_ENV === 'development',
    mockStreamingServer: process.env.NODE_ENV === 'development'
  }
} as const

// Stream type validation
export function isValidStreamType(type: string): type is StreamType {
  return ['webcam', 'screen', 'both', 'combined'].includes(type)
}

// Get media constraints for stream type
export function getMediaConstraints(streamType: StreamType, fallback = false) {
  const constraints = fallback ? 
    STREAM_CONFIG.MEDIA_CONSTRAINTS.fallback : 
    STREAM_CONFIG.MEDIA_CONSTRAINTS[streamType === 'both' || streamType === 'combined' ? 'webcam' : streamType]
  
  return constraints || STREAM_CONFIG.MEDIA_CONSTRAINTS.fallback
}

// Get WebRTC configuration
export function getWebRTCConfig(): RTCConfiguration {
  return {
    ...STREAM_CONFIG.WEBRTC,
    iceServers: STREAM_CONFIG.WEBRTC.iceServers.map(server => ({
      ...server,
      urls: Array.isArray(server.urls) ? server.urls : [server.urls]
    }))
  }
}

// Get quality settings based on connection
export function getQualitySettings(connectionType: 'high' | 'medium' | 'low' = 'medium') {
  return STREAM_CONFIG.QUALITY_SETTINGS[connectionType]
}

// Connection health assessment
export function assessConnectionHealth(stats: {
  latency: number;
  bandwidth: number;
  packetLoss: number;
}): 'excellent' | 'good' | 'fair' | 'poor' {
  const { latency, bandwidth, packetLoss } = stats
  
  if (latency < 100 && bandwidth > 2000000 && packetLoss < 1) {
    return 'excellent'
  } else if (latency < 200 && bandwidth > 1000000 && packetLoss < 3) {
    return 'good'
  } else if (latency < 500 && bandwidth > 500000 && packetLoss < 5) {
    return 'fair'
  } else {
    return 'poor'
  }
}

// Auto-adjust quality based on connection
export function getRecommendedQuality(connectionHealth: 'excellent' | 'good' | 'fair' | 'poor'): 'high' | 'medium' | 'low' {
  switch (connectionHealth) {
    case 'excellent':
      return 'high'
    case 'good':
      return 'medium'
    case 'fair':
    case 'poor':
      return 'low'
    default:
      return 'medium'
  }
}

// Create error with context
export function createStreamError(code: string, message: string, context?: any) {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    context: context || {}
  }
}

// Enhanced logging utility
export function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  if (!STREAM_CONFIG.DEV.enableDetailedLogging && level === 'info') {
    return
  }

  const emoji = level === 'info' ? '📝' : level === 'warn' ? '⚠️' : '❌'
  const timestamp = new Date().toISOString()
  
  console[level](`${emoji} [${timestamp}] ${message}`, data ? data : '')
}

// Test all connection methods
export async function testAllConnectionMethods(): Promise<{
  websocket: boolean;
  broadcastChannel: boolean;
  webrtc: boolean;
  localStorage: boolean;
}> {
  const results = {
    websocket: false,
    broadcastChannel: false,
    webrtc: false,
    localStorage: false
  }

  // Test WebSocket
  try {
    const testSocket = new WebSocket('ws://localhost:3001')
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        testSocket.close()
        reject(new Error('timeout'))
      }, 2000)
      
      testSocket.onopen = () => {
        clearTimeout(timeout)
        testSocket.close()
        results.websocket = true
        resolve(undefined)
      }
      
      testSocket.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('connection failed'))
      }
    })
  } catch (error) {
    log('warn', 'WebSocket test failed', error)
  }

  // Test BroadcastChannel
  try {
    if ('BroadcastChannel' in window) {
      const testChannel = new BroadcastChannel('stream-test')
      testChannel.close()
      results.broadcastChannel = true
    }
  } catch (error) {
    log('warn', 'BroadcastChannel test failed', error)
  }

  // Test WebRTC
  try {
    const testPc = new RTCPeerConnection(getWebRTCConfig())
    await testPc.createOffer()
    testPc.close()
    results.webrtc = true
  } catch (error) {
    log('warn', 'WebRTC test failed', error)
  }

  // Test localStorage
  try {
    localStorage.setItem('stream-test', 'test')
    localStorage.removeItem('stream-test')
    results.localStorage = true
  } catch (error) {
    log('warn', 'localStorage test failed', error)
  }

  log('info', 'Connection method test results', results)
  return results
}