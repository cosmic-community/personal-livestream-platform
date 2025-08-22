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
    enableBroadcastChannel: boolean
    maxFallbackDuration: number
    fallbackRetryInterval: number
  }
  MEDIA: {
    video: MediaTrackConstraints
    audio: MediaTrackConstraints
  }
}

export function log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  
  switch (level) {
    case 'error':
      console.error(prefix, message, data || '')
      break
    case 'warn':
      console.warn(prefix, message, data || '')
      break
    default:
      console.log(prefix, message, data || '')
  }
}

export default {
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
    bundlePolicy: 'balanced' as RTCBundlePolicy,
    rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy
  },
  FALLBACK: {
    enableFallbackMode: true,
    enableBroadcastChannel: true,
    maxFallbackDuration: 300000,
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