import { NextRequest, NextResponse } from 'next/server'
import { getMuxClient } from '@/lib/mux-client'

export async function GET() {
  try {
    const mux = getMuxClient()
    
    // In a real implementation, you'd fetch from your database or Mux API
    // This is a simplified version for demonstration
    const streams = [] // Fetch your streams here
    
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