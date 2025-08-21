import { NextRequest, NextResponse } from 'next/server'
import { getMuxClient } from '@/lib/mux-client'

export async function GET() {
  try {
    const muxClient = getMuxClient()
    
    // Get all live streams (this would be implemented in the Mux client)
    // For now, return empty array to prevent errors
    const streams: any[] = []
    
    return NextResponse.json(streams)
  } catch (error) {
    console.error('Failed to fetch streams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch streams' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const muxClient = getMuxClient()
    
    const stream = await muxClient.createLiveStream({
      playbackPolicy: body.playbackPolicy || 'public',
      reducedLatency: body.reducedLatency || true,
      reconnectWindow: body.reconnectWindow || 60,
      newAssetSettings: body.newAssetSettings || {
        playbackPolicy: 'public',
        mp4Support: 'capped-1080p',
        normalizeAudio: true
      }
    })
    
    return NextResponse.json(stream)
  } catch (error) {
    console.error('Failed to create stream:', error)
    return NextResponse.json(
      { error: 'Failed to create stream' },
      { status: 500 }
    )
  }
}