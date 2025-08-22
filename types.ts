export interface StreamState {
  isLive: boolean
  isConnecting: boolean
  streamType: 'webcam' | 'screen' | 'both'
  webcamEnabled: boolean
  screenEnabled: boolean
  viewerCount: number
  sessionId?: string
  error?: string
  lastUpdated: string
}

export type StreamType = 'webcam' | 'screen' | 'both'

export interface StreamError {
  code: string
  message: string
  timestamp: string
  details?: any
}

export function createStreamState(overrides?: Partial<StreamState>): StreamState {
  return {
    isLive: false,
    isConnecting: false,
    streamType: 'webcam',
    webcamEnabled: false,
    screenEnabled: false,
    viewerCount: 0,
    lastUpdated: new Date().toISOString(),
    ...overrides
  }
}

// Cosmic CMS types
export interface CosmicObject {
  id: string
  title: string
  slug: string
  content?: string
  metadata?: any
  created_at: string
  modified_at: string
  status: string
}

export interface CosmicResponse<T = any> {
  object?: T
  objects: T[]
  total: number
}

export interface StreamSession extends CosmicObject {
  metadata: {
    start_time: string
    end_time?: string
    stream_type: StreamType
    viewer_count: number
    peak_viewers: number
    duration: number
    status: 'starting' | 'live' | 'ended'
  }
}

export interface StreamAnalytics extends CosmicObject {
  metadata: {
    session_id: string
    viewer_joined_at: string
    viewer_left_at?: string
    watch_duration: number
    user_agent: string
    ip_address: string
  }
}

export interface StreamSettings extends CosmicObject {
  metadata: {
    default_stream_type: StreamType
    auto_start_enabled: boolean
    stream_quality: 'low' | 'medium' | 'high'
    enable_analytics: boolean
    notification_settings: {
      email_on_stream_start: boolean
      email_on_viewer_milestone: boolean
    }
  }
}