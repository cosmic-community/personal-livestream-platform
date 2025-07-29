import { createBucketClient } from '@cosmicjs/sdk'
import { StreamSession, StreamAnalytics, StreamSettings, CosmicResponse } from '@/types'

export const cosmic = createBucketClient({
  bucketSlug: process.env.COSMIC_BUCKET_SLUG as string,
  readKey: process.env.COSMIC_READ_KEY as string,
  writeKey: process.env.COSMIC_WRITE_KEY as string,
})

// Stream session management
export async function createStreamSession(data: {
  stream_type: 'webcam' | 'screen' | 'both';
  start_time: string;
}): Promise<StreamSession> {
  try {
    const response = await cosmic.objects.insertOne({
      type: 'stream-sessions',
      title: `Stream Session ${new Date().toLocaleString()}`,
      metadata: {
        start_time: data.start_time,
        stream_type: data.stream_type,
        viewer_count: 0,
        peak_viewers: 0,
        duration: 0,
        status: 'starting'
      }
    })
    
    return response.object as StreamSession
  } catch (error) {
    console.error('Error creating stream session:', error)
    throw new Error('Failed to create stream session')
  }
}

export async function updateStreamSession(
  sessionId: string, 
  updates: Partial<StreamSession['metadata']>
): Promise<StreamSession> {
  try {
    const response = await cosmic.objects.updateOne(sessionId, {
      metadata: updates
    })
    
    return response.object as StreamSession
  } catch (error) {
    console.error('Error updating stream session:', error)
    throw new Error('Failed to update stream session')
  }
}

export async function endStreamSession(sessionId: string): Promise<StreamSession> {
  const endTime = new Date().toISOString()
  
  try {
    // Get current session to calculate duration
    const currentSession = await getStreamSession(sessionId)
    const startTime = new Date(currentSession.metadata.start_time)
    const duration = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000)
    
    const response = await cosmic.objects.updateOne(sessionId, {
      metadata: {
        end_time: endTime,
        duration: duration,
        status: 'ended'
      }
    })
    
    return response.object as StreamSession
  } catch (error) {
    console.error('Error ending stream session:', error)
    throw new Error('Failed to end stream session')
  }
}

export async function getStreamSession(sessionId: string): Promise<StreamSession> {
  try {
    const response = await cosmic.objects.findOne({
      type: 'stream-sessions',
      id: sessionId
    })
    
    return response.object as StreamSession
  } catch (error) {
    if (error.status === 404) {
      throw new Error('Stream session not found')
    }
    console.error('Error fetching stream session:', error)
    throw new Error('Failed to fetch stream session')
  }
}

export async function getCurrentLiveSession(): Promise<StreamSession | null> {
  try {
    const response = await cosmic.objects.find({
      type: 'stream-sessions',
      'metadata.status': 'live'
    })
    .props(['id', 'title', 'metadata', 'created_at'])
    .limit(1)
    
    return response.objects.length > 0 ? response.objects[0] as StreamSession : null
  } catch (error) {
    if (error.status === 404) {
      return null
    }
    console.error('Error fetching current live session:', error)
    throw new Error('Failed to fetch current live session')
  }
}

export async function getRecentStreamSessions(limit: number = 10): Promise<StreamSession[]> {
  try {
    const response = await cosmic.objects.find({
      type: 'stream-sessions'
    })
    .props(['id', 'title', 'metadata', 'created_at'])
    .sort('-created_at')
    .limit(limit)
    
    return response.objects as StreamSession[]
  } catch (error) {
    if (error.status === 404) {
      return []
    }
    console.error('Error fetching recent sessions:', error)
    throw new Error('Failed to fetch recent sessions')
  }
}

// Stream analytics
export async function recordViewerJoin(sessionId: string, viewerData: {
  user_agent?: string;
  ip_address?: string;
}): Promise<StreamAnalytics> {
  try {
    const response = await cosmic.objects.insertOne({
      type: 'stream-analytics',
      title: `Viewer Join - ${new Date().toLocaleString()}`,
      metadata: {
        session_id: sessionId,
        viewer_joined_at: new Date().toISOString(),
        watch_duration: 0,
        user_agent: viewerData.user_agent || '',
        ip_address: viewerData.ip_address || ''
      }
    })
    
    return response.object as StreamAnalytics
  } catch (error) {
    console.error('Error recording viewer join:', error)
    throw new Error('Failed to record viewer join')
  }
}

export async function recordViewerLeave(
  analyticsId: string, 
  watchDuration: number
): Promise<StreamAnalytics> {
  try {
    const response = await cosmic.objects.updateOne(analyticsId, {
      metadata: {
        viewer_left_at: new Date().toISOString(),
        watch_duration: watchDuration
      }
    })
    
    return response.object as StreamAnalytics
  } catch (error) {
    console.error('Error recording viewer leave:', error)
    throw new Error('Failed to record viewer leave')
  }
}

// Stream settings
export async function getStreamSettings(): Promise<StreamSettings | null> {
  try {
    const response = await cosmic.objects.find({
      type: 'stream-settings'
    })
    .limit(1)
    
    return response.objects.length > 0 ? response.objects[0] as StreamSettings : null
  } catch (error) {
    if (error.status === 404) {
      return null
    }
    console.error('Error fetching stream settings:', error)
    return null
  }
}

export async function updateStreamSettings(
  settings: Partial<StreamSettings['metadata']>
): Promise<StreamSettings> {
  try {
    // Try to get existing settings first
    const existingSettings = await getStreamSettings()
    
    if (existingSettings) {
      // Update existing settings
      const response = await cosmic.objects.updateOne(existingSettings.id, {
        metadata: {
          ...existingSettings.metadata,
          ...settings
        }
      })
      return response.object as StreamSettings
    } else {
      // Create new settings
      const response = await cosmic.objects.insertOne({
        type: 'stream-settings',
        title: 'Stream Settings',
        metadata: {
          default_stream_type: 'webcam',
          auto_start_enabled: false,
          stream_quality: 'medium',
          enable_analytics: true,
          notification_settings: {
            email_on_stream_start: false,
            email_on_viewer_milestone: false
          },
          ...settings
        }
      })
      return response.object as StreamSettings
    }
  } catch (error) {
    console.error('Error updating stream settings:', error)
    throw new Error('Failed to update stream settings')
  }
}

// Error helper for Cosmic SDK
function hasStatus(error: unknown): error is { status: number } {
  return typeof error === 'object' && error !== null && 'status' in error;
}