// app/api/mux/streams/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getMuxClient } from '@/lib/mux-client'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const mux = getMuxClient()
    
    const stream = await mux.getLiveStream(id)
    
    return NextResponse.json({
      id: stream.id,
      status: stream.status,
      isLive: stream.status === 'active'
    })
  } catch (error) {
    console.error('Error fetching Mux stream status:', error)
    return NextResponse.json(
      { message: 'Failed to fetch stream status' }, 
      { status: 404 }
    )
  }
}