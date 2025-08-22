// app/api/mux/streams/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getMuxClient } from '@/lib/mux-client'

interface Params {
  id: string
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const { id } = await context.params
    const muxClient = getMuxClient()
    
    const stream = await muxClient.getLiveStream(id)
    
    return NextResponse.json({ 
      status: stream.status,
      isLive: stream.status === 'active'
    })
    
  } catch (error) {
    console.error('Failed to get stream status:', error)
    return NextResponse.json(
      { error: 'Failed to get stream status' },
      { status: 500 }
    )
  }
}