export interface StreamConfig {
  SERVER_URLS: string[]
  CONNECTION: {
    timeout: number
    maxRetries: number
    maxUrlAttempts: number
    reconnectBackoff: number[]
    transports: string[]
    autoConnect: boolean
    forceNew: boolean
    healthCheckInterval: number
  }
  WEBRTC: {
    iceServers: RTCIceServer[]
    iceCandidatePoolSize: number
    bundlePolicy: RTCBundlePolicy
    rtcpMuxPolicy: RTCRtcpMuxPolicy
  }
  FALLBACK: {
    enableFallbackMode: boolean
    maxFallbackDuration: number
    fallbackRetryInterval: number
  }
  MEDIA: {
    video: {
      width: { min: number; ideal: number; max: number }
      height: { min: number; ideal: number; max: number }
      frameRate: { ideal: number; max: number }
    }
    audio: {
      echoCancellation: boolean
      noiseSuppression: boolean
      autoGainControl: boolean
    }
  }
}

export const defaultStreamConfig: StreamConfig = {
  SERVER_URLS: [
    'ws://localhost:3001',
    'wss://streaming-server.example.com'
  ],
  CONNECTION: {
    timeout: 10000,
    maxRetries: 3,
    maxUrlAttempts: 2,
    reconnectBackoff: [1000, 2000, 4000, 8000],
    transports: ['websocket'],
    autoConnect: true,
    forceNew: false,
    healthCheckInterval: 30000
  },
  WEBRTC: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'balanced',
    rtcpMuxPolicy: 'require'
  },
  FALLBACK: {
    enableFallbackMode: true,
    maxFallbackDuration: 300000, // 5 minutes
    fallbackRetryInterval: 5000
  },
  MEDIA: {
    video: {
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 480, ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  }
}

export function getStreamConfig(): StreamConfig {
  return { ...defaultStreamConfig }
}

export function getWebRTCConfig(): RTCConfiguration {
  return {
    iceServers: defaultStreamConfig.WEBRTC.iceServers,
    iceCandidatePoolSize: defaultStreamConfig.WEBRTC.iceCandidatePoolSize,
    bundlePolicy: defaultStreamConfig.WEBRTC.bundlePolicy,
    rtcpMuxPolicy: defaultStreamConfig.WEBRTC.rtcpMuxPolicy
  }
}

export interface StreamError {
  code: string
  message: string
  timestamp: string
  details?: any
}

export function createStreamError(
  code: string, 
  message: string, 
  details?: any
): StreamError {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    details
  }
}

export async function testAllConnectionMethods(): Promise<{
  websocket: boolean
  webrtc: boolean
  mediaDevices: boolean
}> {
  const results = {
    websocket: false,
    webrtc: false,
    mediaDevices: false
  }

  // Test WebSocket
  try {
    const ws = new WebSocket('ws://localhost:3001')
    ws.close()
    results.websocket = true
  } catch (error) {
    console.warn('WebSocket not available:', error)
  }

  // Test WebRTC
  try {
    const pc = new RTCPeerConnection()
    pc.close()
    results.webrtc = true
  } catch (error) {
    console.warn('WebRTC not available:', error)
  }

  // Test Media Devices
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      results.mediaDevices = true
    }
  } catch (error) {
    console.warn('Media devices not available:', error)
  }

  return results
}

export function validateStreamConfig(config: Partial<StreamConfig>): boolean {
  try {
    if (!config.SERVER_URLS || !Array.isArray(config.SERVER_URLS)) {
      return false
    }

    if (!config.CONNECTION || typeof config.CONNECTION.timeout !== 'number') {
      return false
    }

    return true
  } catch (error) {
    return false
  }
}