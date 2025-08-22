// app/api/mux/streams/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getMuxClient } from '@/lib/mux-client'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const muxClient = getMuxClient()
    
    console.log('📊 Checking stream status:', id)
    
    const stream = await muxClient.getLiveStream(id)
    
    return NextResponse.json({
      id: stream.id,
      status: stream.status,
      isLive: stream.status === 'active',
      streamKey: stream.streamKey ? 'configured' : 'missing',
      playbackIds: stream.playbackIds.length,
      lastChecked: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Failed to get stream status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get stream status',
        status: 'unknown',
        isLive: false
      },
      { status: 500 }
    )
  }
}