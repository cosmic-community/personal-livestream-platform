export const STREAM_CONFIG = {
  // WebSocket server URLs - updated for better connection reliability
  SERVER_URLS: [
    'ws://localhost:3001',
    'ws://127.0.0.1:3001',
    ...(typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
      ? [`ws://${window.location.hostname}:3001`] 
      : []
    )
  ],
  
  CONNECTION: {
    timeout: 8000, // Increased timeout for better reliability
    reconnectBackoff: [1000, 2000, 4000, 8000, 16000], // Progressive backoff
    maxRetries: 5,
    maxUrlAttempts: 3,
    healthCheckInterval: 15000,
    forceWebSockets: true, // Force WebSocket transport
    transports: ['websocket'], // Only use WebSocket transport
    upgrade: true,
    rememberUpgrade: true
  },
  
  WEBRTC: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ],
    configuration: {
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10
    }
  },
  
  FALLBACK: {
    enableBroadcastChannel: true,
    enableLocalStorage: true,
    enableWebRTCDirect: true,
    fallbackTimeout: 10000,
    maxFallbackAttempts: 3
  },
  
  LOGGING: {
    level: 'info', // Changed from debug to info for better visibility
    enableConsole: true,
    enableRemote: false,
    maxLogEntries: 100
  }
}

// Enhanced logging function with better error tracking
export function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
  if (!STREAM_CONFIG.LOGGING.enableConsole) return
  
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  
  switch (level) {
    case 'debug':
      if (STREAM_CONFIG.LOGGING.level === 'debug') {
        console.debug(prefix, message, data || '')
      }
      break
    case 'info':
      if (['debug', 'info'].includes(STREAM_CONFIG.LOGGING.level)) {
        console.info(prefix, message, data || '')
      }
      break
    case 'warn':
      if (['debug', 'info', 'warn'].includes(STREAM_CONFIG.LOGGING.level)) {
        console.warn(prefix, message, data || '')
      }
      break
    case 'error':
      console.error(prefix, message, data || '')
      break
  }
}

export function createStreamError(code: string, message: string, details?: any) {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    details
  }
}

// Test connection methods availability
export async function testAllConnectionMethods(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {}
  
  // Test WebSocket
  try {
    results.websocket = typeof WebSocket !== 'undefined'
  } catch {
    results.websocket = false
  }
  
  // Test BroadcastChannel
  try {
    results.broadcastChannel = typeof BroadcastChannel !== 'undefined'
  } catch {
    results.broadcastChannel = false
  }
  
  // Test LocalStorage
  try {
    localStorage.setItem('test', 'test')
    localStorage.removeItem('test')
    results.localStorage = true
  } catch {
    results.localStorage = false
  }
  
  // Test WebRTC
  try {
    const pc = new RTCPeerConnection()
    pc.close()
    results.webrtc = true
  } catch {
    results.webrtc = false
  }
  
  log('info', '🔍 Connection methods tested:', results)
  return results
}

// Network connectivity test
export async function testNetworkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch('https://www.google.com/favicon.ico', {
      mode: 'no-cors',
      cache: 'no-cache'
    })
    return true
  } catch {
    return false
  }
}

// Server health check
export async function checkServerHealth(url: string): Promise<boolean> {
  try {
    const httpUrl = url.replace('ws://', 'http://').replace('wss://', 'https://')
    const response = await fetch(`${httpUrl}/health`, {
      method: 'GET',
      timeout: 5000
    })
    return response.ok
  } catch {
    return false
  }
}