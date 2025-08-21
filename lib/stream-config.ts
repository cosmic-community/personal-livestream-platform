export const STREAM_CONFIG = {
  SERVER_URLS: [
    process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:3001',
    'ws://localhost:3001' // fallback
  ],
  CONNECTION: {
    timeout: 15000,
    maxRetries: 5,
    maxUrlAttempts: 2,
    reconnectBackoff: [1000, 2000, 4000, 8000, 15000],
    transports: ['websocket'],
    autoConnect: false,
    forceNew: true
  },
  FALLBACK: {
    enableBroadcastChannel: true,
    mockMode: true
  },
  MEDIA: {
    video: {
      width: { ideal: 1280, max: 1920, min: 640 },
      height: { ideal: 720, max: 1080, min: 480 },
      frameRate: { ideal: 30, max: 60, min: 15 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  }
}

export function log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [STREAM-${level.toUpperCase()}]`
  
  switch (level) {
    case 'info':
      console.log(prefix, message, data || '')
      break
    case 'warn':
      console.warn(prefix, message, data || '')
      break
    case 'error':
      console.error(prefix, message, data || '')
      break
  }
}