import { NextRequest, NextResponse } from 'next/server'
import { getMuxClient } from '@/lib/mux-client'

interface MuxStreamResponse {
  id: string
  streamKey: string
  playbackIds: Array<{ id: string; policy: string }>
  status: string
  rtmpUrl: string
  createdAt: string
}

export async function GET() {
  try {
    const mux = getMuxClient()
    
    // Properly type the streams array as empty for now
    // In a real implementation, you'd fetch from your database or Mux API
    const streams: MuxStreamResponse[] = [] // Explicitly type as MuxStreamResponse array
    
    return NextResponse.json(streams)
  } catch (error) {
    console.error('Error fetching Mux streams:', error)
    return NextResponse.json(
      { message: 'Failed to fetch streams' }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const mux = getMuxClient()
    
    const stream = await mux.createLiveStream({
      playbackPolicy: body.playbackPolicy || 'public',
      reducedLatency: body.reducedLatency || true,
      reconnectWindow: body.reconnectWindow || 60,
      newAssetSettings: body.newAssetSettings
    })

    return NextResponse.json(stream, { status: 201 })
  } catch (error) {
    console.error('Error creating Mux stream:', error)
    return NextResponse.json(
      { message: 'Failed to create stream' }, 
      { status: 500 }
    )
  }
}