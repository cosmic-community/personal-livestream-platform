import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { headers } from 'next/headers'

// Webhook event interfaces based on Mux documentation
interface MuxWebhookEvent {
  type: string
  object: {
    type: string
    id: string
  }
  id: string
  environment: {
    name: string
    id: string
  }
  data: {
    id: string
    status?: string
    stream_key?: string
    playback_ids?: Array<{ id: string; policy: string }>
    recent_asset_ids?: string[]
    created_at?: string
    reconnect_window?: number
    reduced_latency?: boolean
    // Asset-specific fields
    duration?: number
    aspect_ratio?: string
    tracks?: Array<{
      id: string
      type: string
      duration?: number
    }>
  }
  created_at: string
  request_id: string | null
  accessor: string | null
  accessor_source: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('mux-signature')
    
    if (!signature) {
      console.error('❌ Missing Mux signature header')
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      )
    }

    // Verify webhook signature for security
    const webhookSecret = process.env.MUX_WEBHOOK_SECRET
    if (webhookSecret) {
      const isValid = verifyMuxSignature(body, signature, webhookSecret)
      if (!isValid) {
        console.error('❌ Invalid Mux webhook signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    } else {
      console.warn('⚠️ MUX_WEBHOOK_SECRET not configured - skipping signature verification')
    }

    const event: MuxWebhookEvent = JSON.parse(body)
    console.log('📡 Received Mux webhook:', event.type, 'for:', event.data.id)

    // Handle different Mux webhook events
    switch (event.type) {
      // Live Stream Events
      case 'video.live_stream.connected':
        await handleStreamConnected(event)
        break
        
      case 'video.live_stream.recording':
        await handleStreamRecording(event)
        break
        
      case 'video.live_stream.active':
        await handleStreamActive(event)
        break
        
      case 'video.live_stream.idle':
        await handleStreamIdle(event)
        break
        
      case 'video.live_stream.disconnected':
        await handleStreamDisconnected(event)
        break
        
      // Asset Events (for recordings)
      case 'video.asset.created':
        await handleAssetCreated(event)
        break
        
      case 'video.asset.ready':
        await handleAssetReady(event)
        break
        
      case 'video.asset.errored':
        await handleAssetError(event)
        break
        
      case 'video.asset.live_stream_completed':
        await handleAssetLiveStreamCompleted(event)
        break
        
      // Track Events (for subtitles)
      case 'video.asset.track.created':
        await handleTrackCreated(event)
        break
        
      case 'video.asset.track.ready':
        await handleTrackReady(event)
        break
        
      case 'video.asset.track.errored':
        await handleTrackError(event)
        break
        
      default:
        console.log('📨 Unhandled Mux webhook type:', event.type)
    }

    // Log webhook for debugging
    await logWebhookEvent(event)

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('❌ Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// Verify Mux webhook signature using HMAC-SHA256
function verifyMuxSignature(payload: string, signature: string, secret: string): boolean {
  try {
    // Mux sends signature as "t=timestamp,v1=signature"
    const elements = signature.split(',')
    const timestampElement = elements.find(element => element.startsWith('t='))
    const signatureElement = elements.find(element => element.startsWith('v1='))
    
    if (!timestampElement || !signatureElement) {
      return false
    }
    
    const timestamp = timestampElement.split('=')[1]
    const sig = signatureElement.split('=')[1]
    
    if (!timestamp || !sig) {
      return false
    }
    
    // Create expected signature
    const signedPayload = `${timestamp}.${payload}`
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex')
    
    // Compare signatures
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(sig, 'hex')
    )
    
  } catch (error) {
    console.error('❌ Signature verification error:', error)
    return false
  }
}

// Event Handlers
async function handleStreamConnected(event: MuxWebhookEvent) {
  console.log('🔗 Live stream connected:', event.data.id)
  
  // Here you could update your database or notify connected clients
  // For example, using Server-Sent Events or WebSocket
  
  // You could also update stream status in Cosmic CMS
  await updateStreamStatus(event.data.id, 'connected')
}

async function handleStreamRecording(event: MuxWebhookEvent) {
  console.log('🔴 Live stream recording started:', event.data.id)
  
  // Update stream status and start any recording-specific logic
  await updateStreamStatus(event.data.id, 'recording')
  
  // Notify viewers that recording has started
  await notifyViewers(event.data.id, {
    type: 'recording_started',
    message: 'Stream recording has started'
  })
}

async function handleStreamActive(event: MuxWebhookEvent) {
  console.log('🟢 Live stream is now active:', event.data.id)
  
  // Stream is now playable
  await updateStreamStatus(event.data.id, 'active')
  
  // Notify all viewers that the stream is live
  await notifyViewers(event.data.id, {
    type: 'stream_active',
    message: 'Stream is now live!',
    playbackIds: event.data.playback_ids
  })
  
  // Update analytics or metrics
  await updateStreamMetrics(event.data.id, { went_live_at: new Date().toISOString() })
}

async function handleStreamIdle(event: MuxWebhookEvent) {
  console.log('🟡 Live stream is now idle:', event.data.id)
  
  // Stream has ended
  await updateStreamStatus(event.data.id, 'idle')
  
  // Notify viewers that stream has ended
  await notifyViewers(event.data.id, {
    type: 'stream_ended',
    message: 'Stream has ended'
  })
  
  // Finalize analytics
  await finalizeStreamAnalytics(event.data.id)
}

async function handleStreamDisconnected(event: MuxWebhookEvent) {
  console.log('🔴 Live stream disconnected:', event.data.id)
  
  // Handle unexpected disconnection
  await updateStreamStatus(event.data.id, 'disconnected')
  
  // Notify viewers about disconnection
  await notifyViewers(event.data.id, {
    type: 'stream_disconnected',
    message: 'Stream temporarily disconnected. Attempting to reconnect...'
  })
}

async function handleAssetCreated(event: MuxWebhookEvent) {
  console.log('📹 Asset created from live stream:', event.data.id)
  
  // Asset (recording) has been created but not yet ready
  await logAssetEvent(event.data.id, 'created')
}

async function handleAssetReady(event: MuxWebhookEvent) {
  console.log('✅ Asset ready:', event.data.id)
  
  // Recording is now ready for playback
  await updateAssetStatus(event.data.id, 'ready')
  
  // Generate subtitles automatically if needed
  if (event.data.tracks && event.data.tracks.length > 0) {
    const videoTrack = event.data.tracks.find(track => track.type === 'video')
    if (videoTrack) {
      await generateSubtitlesForAsset(event.data.id, videoTrack.id)
    }
  }
  
  // Notify users that recording is available
  await notifyRecordingReady(event.data.id)
}

async function handleAssetError(event: MuxWebhookEvent) {
  console.error('❌ Asset error:', event.data.id)
  
  // Handle asset processing error
  await updateAssetStatus(event.data.id, 'error')
  await logAssetError(event.data.id, event)
}

async function handleAssetLiveStreamCompleted(event: MuxWebhookEvent) {
  console.log('🏁 Live stream recording completed:', event.data.id)
  
  // The asset is now an on-demand video (no longer live)
  await finalizeStreamRecording(event.data.id)
}

async function handleTrackCreated(event: MuxWebhookEvent) {
  console.log('🎵 Track created:', event.data.id)
  // Track (audio, video, or subtitle) created
}

async function handleTrackReady(event: MuxWebhookEvent) {
  console.log('✅ Track ready:', event.data.id)
  
  // Track is ready - could be subtitles that were generated
  await updateTrackStatus(event.data.id, 'ready')
}

async function handleTrackError(event: MuxWebhookEvent) {
  console.error('❌ Track error:', event.data.id)
  await logTrackError(event.data.id, event)
}

// Helper functions (these would interact with your database/CMS)
async function updateStreamStatus(streamId: string, status: string) {
  try {
    console.log(`📝 Updating stream ${streamId} status to: ${status}`)
    
    // Here you could update Cosmic CMS or your database
    // Example with Cosmic CMS:
    // const cosmic = createBucketClient({
    //   bucketSlug: process.env.COSMIC_BUCKET_SLUG,
    //   readKey: process.env.COSMIC_READ_KEY,
    //   writeKey: process.env.COSMIC_WRITE_KEY
    // })
    
    // await cosmic.objects.updateOne(streamId, {
    //   metadata: { status }
    // })
    
  } catch (error) {
    console.error('❌ Error updating stream status:', error)
  }
}

async function notifyViewers(streamId: string, notification: any) {
  try {
    console.log(`📢 Notifying viewers for stream ${streamId}:`, notification.type)
    
    // Here you would implement real-time notifications
    // This could be via WebSocket, Server-Sent Events, or a push notification service
    
    // Example implementation would broadcast to all connected clients
    // broadcastToViewers(streamId, notification)
    
  } catch (error) {
    console.error('❌ Error notifying viewers:', error)
  }
}

async function updateStreamMetrics(streamId: string, metrics: any) {
  try {
    console.log(`📊 Updating metrics for stream ${streamId}`)
    // Update analytics/metrics in your database
  } catch (error) {
    console.error('❌ Error updating stream metrics:', error)
  }
}

async function finalizeStreamAnalytics(streamId: string) {
  try {
    console.log(`📈 Finalizing analytics for stream ${streamId}`)
    // Calculate final metrics like total duration, peak viewers, etc.
  } catch (error) {
    console.error('❌ Error finalizing stream analytics:', error)
  }
}

async function updateAssetStatus(assetId: string, status: string) {
  try {
    console.log(`📹 Updating asset ${assetId} status to: ${status}`)
    // Update asset status in your system
  } catch (error) {
    console.error('❌ Error updating asset status:', error)
  }
}

async function generateSubtitlesForAsset(assetId: string, trackId: string) {
  try {
    console.log(`📝 Generating subtitles for asset ${assetId}, track ${trackId}`)
    
    // Call Mux API to generate subtitles
    const response = await fetch(`/api/mux/streams/${assetId}/subtitles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId })
    })
    
    if (response.ok) {
      console.log('✅ Subtitle generation initiated')
    }
    
  } catch (error) {
    console.error('❌ Error generating subtitles:', error)
  }
}

async function notifyRecordingReady(assetId: string) {
  try {
    console.log(`📹 Recording ready notification for asset ${assetId}`)
    // Notify users that their stream recording is ready
  } catch (error) {
    console.error('❌ Error notifying recording ready:', error)
  }
}

async function finalizeStreamRecording(assetId: string) {
  try {
    console.log(`🏁 Finalizing stream recording for asset ${assetId}`)
    // Mark recording as complete and available for on-demand viewing
  } catch (error) {
    console.error('❌ Error finalizing stream recording:', error)
  }
}

async function logWebhookEvent(event: MuxWebhookEvent) {
  try {
    // Log webhook events for debugging and audit purposes
    console.log(`📝 Webhook logged: ${event.type} at ${event.created_at}`)
  } catch (error) {
    console.error('❌ Error logging webhook event:', error)
  }
}

async function logAssetEvent(assetId: string, eventType: string) {
  try {
    console.log(`📝 Asset event logged: ${eventType} for ${assetId}`)
  } catch (error) {
    console.error('❌ Error logging asset event:', error)
  }
}

async function logAssetError(assetId: string, event: MuxWebhookEvent) {
  try {
    console.error(`❌ Asset error logged for ${assetId}:`, event)
  } catch (error) {
    console.error('❌ Error logging asset error:', error)
  }
}

async function updateTrackStatus(trackId: string, status: string) {
  try {
    console.log(`🎵 Updating track ${trackId} status to: ${status}`)
  } catch (error) {
    console.error('❌ Error updating track status:', error)
  }
}

async function logTrackError(trackId: string, event: MuxWebhookEvent) {
  try {
    console.error(`❌ Track error logged for ${trackId}:`, event)
  } catch (error) {
    console.error('❌ Error logging track error:', error)
  }
}

export const dynamic = 'force-dynamic'