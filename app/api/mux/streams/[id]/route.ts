// app/api/mux/streams/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getMuxClient } from '@/lib/mux-client'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 15+, params is a Promise and must be awaited
    const { id } = await context.params
    const mux = getMuxClient()
    
    const stream = await mux.getLiveStream(id)
    return NextResponse.json(stream)
  } catch (error) {
    console.error('Error fetching Mux stream:', error)
    return NextResponse.json(
      { message: 'Stream not found' }, 
      { status: 404 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 15+, params is a Promise and must be awaited
    const { id } = await context.params
    const mux = getMuxClient()
    
    await mux.deleteLiveStream(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting Mux stream:', error)
    return NextResponse.json(
      { message: 'Failed to delete stream' }, 
      { status: 500 }
    )
  }
}