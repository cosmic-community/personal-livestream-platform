import { NextRequest, NextResponse } from 'next/server'
import { getMuxClient } from '@/lib/mux-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const muxClient = getMuxClient()
    
    console.log('🎥 Creating new Mux live stream...')
    console.warn('🔐 SECURITY: New stream key will be generated - treat as private credential')
    
    // Create unique live stream with enhanced configuration
    const liveStream = await muxClient.createLiveStream({
      playbackPolicy: body.playbackPolicy || 'public',
      reducedLatency: body.reducedLatency || true,
      reconnectWindow: body.reconnectWindow || 60,
      newAssetSettings: {
        playbackPolicy: body.newAssetSettings?.playbackPolicy || 'public',
        mp4Support: body.newAssetSettings?.mp4Support || 'capped-1080p',
        normalizeAudio: body.newAssetSettings?.normalizeAudio !== false
      }
    })
    
    // Add security metadata to response
    const responseData = {
      ...liveStream,
      securityNotice: {
        streamKeyPrivacy: 'CRITICAL: Keep stream key private and secure',
        accessControl: 'Anyone with this stream key can broadcast to your stream',
        recommendations: [
          'Store stream key in password manager or secure vault',
          'Never share stream key in public channels, screenshots, or recordings',
          'Monitor stream activity for unauthorized usage',
          'Delete stream or reset key if compromised'
        ]
      }
    }
    
    console.log('✅ New Mux stream created with secure stream key:', liveStream.id)
    
    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Failed to create stream:', error)
    return NextResponse.json(
      { error: 'Failed to create stream' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const muxClient = getMuxClient()
    
    // This would need to be implemented in the Mux client
    // For now, return empty array as Mux doesn't have a direct "list all streams" endpoint
    // You'd typically store stream IDs in your database
    
    return NextResponse.json([])
  } catch (error) {
    console.error('Failed to get streams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch streams' },
      { status: 500 }
    )
  }
}