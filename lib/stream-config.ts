import { StreamType } from '@/types'

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

  // Connection settings
  CONNECTION: {
    timeout: 10000, // 10 seconds
    maxRetries: 5,
    retryDelay: 2000, // 2 seconds
    heartbeatInterval: 25000, // 25 seconds
    reconnectBackoff: [1000, 2000, 4000, 8000, 16000], // Progressive backoff
    healthCheckInterval: 30000 // 30 seconds
  },

  // WebRTC configuration
  WEBRTC: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle' as RTCBundlePolicy,
    rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
    iceTransportPolicy: 'all' as RTCIceTransportPolicy,
    sdpSemantics: 'unified-plan' as RTCSdpSemantics
  },

  // Media constraints for different stream types
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

  // Fallback behavior settings
  FALLBACK: {
    enableOfflineMode: true,
    offlineModeTimeout: 15000, // 15 seconds
    mockViewerRange: [1, 8], // Random viewer count range for fallback
    mockViewerUpdateInterval: 8000 // 8 seconds
  },

  // Development settings
  DEV: {
    enableDetailedLogging: process.env.NODE_ENV === 'development',
    logWebRTCStats: process.env.NODE_ENV === 'development',
    showConnectionDebugInfo: process.env.NODE_ENV === 'development'
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

// Logging utility
export function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  if (!STREAM_CONFIG.DEV.enableDetailedLogging && level === 'info') {
    return
  }

  const emoji = level === 'info' ? '📝' : level === 'warn' ? '⚠️' : '❌'
  const timestamp = new Date().toISOString()
  
  console[level](`${emoji} [${timestamp}] ${message}`, data ? data : '')
}