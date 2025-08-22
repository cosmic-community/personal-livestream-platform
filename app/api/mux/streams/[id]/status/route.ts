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
    
    const stream = await muxClient.getLiveStream(id)
    
    return NextResponse.json({ 
      status: stream.status || 'idle'
    })
  } catch (error) {
    console.error('❌ Failed to fetch stream status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stream status' },
      { status: 500 }
    )
  }
}