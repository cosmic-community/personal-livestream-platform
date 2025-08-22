// app/api/mux/streams/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getMuxClient } from '@/lib/mux-client'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const muxClient = getMuxClient()
    
    const liveStream = await muxClient.getLiveStream(id)
    
    return NextResponse.json({
      status: liveStream.status,
      isLive: liveStream.status === 'active'
    })
  } catch (error) {
    console.error('Failed to get stream status:', error)
    return NextResponse.json(
      { error: 'Failed to get stream status' },
      { status: 500 }
    )
  }
}