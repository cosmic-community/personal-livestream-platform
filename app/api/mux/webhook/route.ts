import { NextRequest, NextResponse } from 'next/server'
import { getMuxClient } from '@/lib/mux-client'

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('mux-signature')
    if (!signature) {
      console.error('❌ Missing Mux signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const body = await request.text()
    const muxClient = getMuxClient()

    // Verify webhook signature
    const isValid = muxClient.verifyWebhookSignature(body, signature)
    if (!isValid) {
      console.error('❌ Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body)
    console.log('📡 Received Mux webhook:', payload.type)

    // Handle different webhook events
    switch (payload.type) {
      case 'video.live_stream.active':
        console.log('🟢 Live stream became active:', payload.data.id)
        await handleStreamActive(payload.data)
        break

      case 'video.live_stream.idle':
        console.log('🟡 Live stream became idle:', payload.data.id)
        await handleStreamIdle(payload.data)
        break

      case 'video.live_stream.disconnected':
        console.log('🔴 Live stream disconnected:', payload.data.id)
        await handleStreamDisconnected(payload.data)
        break

      case 'video.asset.ready':
        console.log('📹 Asset ready (recording available):', payload.data.id)
        await handleAssetReady(payload.data)
        break

      case 'video.asset.errored':
        console.log('❌ Asset error:', payload.data.id)
        await handleAssetError(payload.data)
        break

      case 'video.live_stream.created':
        console.log('🆕 Live stream created:', payload.data.id)
        break

      case 'video.live_stream.deleted':
        console.log('🗑️ Live stream deleted:', payload.data.id)
        break

      default:
        console.log('❓ Unhandled webhook type:', payload.type)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('❌ Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleStreamActive(data: any) {
  // Stream went live - could trigger notifications, analytics, etc.
  console.log('Stream active data:', {
    id: data.id,
    status: data.status,
    playback_ids: data.playback_ids?.length || 0
  })

  // Example: Send notifications, update database, etc.
  // await notifyStreamStart(data.id)
}

async function handleStreamIdle(data: any) {
  // Stream became idle (no longer receiving data)
  console.log('Stream idle data:', {
    id: data.id,
    status: data.status,
    recent_asset_ids: data.recent_asset_ids?.length || 0
  })

  // Example: Clean up resources, update analytics
  // await updateStreamAnalytics(data.id, 'idle')
}

async function handleStreamDisconnected(data: any) {
  // Stream disconnected (encoder stopped)
  console.log('Stream disconnected data:', {
    id: data.id,
    status: data.status
  })

  // Example: Send disconnect notifications
  // await notifyStreamEnd(data.id)
}

async function handleAssetReady(data: any) {
  // Recording is ready for playback
  console.log('Asset ready data:', {
    id: data.id,
    status: data.status,
    playback_ids: data.playback_ids?.length || 0,
    duration: data.duration
  })

  // Example: Notify users that recording is available
  // await notifyRecordingReady(data.id, data.playback_ids)
}

async function handleAssetError(data: any) {
  // Asset processing failed
  console.log('Asset error data:', {
    id: data.id,
    status: data.status,
    errors: data.errors
  })

  // Example: Alert administrators about the error
  // await alertAssetError(data.id, data.errors)
}