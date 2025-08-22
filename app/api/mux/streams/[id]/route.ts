// app/api/mux/streams/[id]/route.ts
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
    
    return NextResponse.json(stream)
  } catch (error) {
    console.error('❌ Failed to fetch stream:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stream' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const muxClient = getMuxClient()
    
    await muxClient.deleteLiveStream(id)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Failed to delete stream:', error)
    return NextResponse.json(
      { error: 'Failed to delete stream' },
      { status: 500 }
    )
  }
}