// app/api/mux/streams/[id]/status/route.ts
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
    return NextResponse.json({ status: stream.status })
  } catch (error) {
    console.error('Error getting stream status:', error)
    return NextResponse.json(
      { message: 'Failed to get stream status' }, 
      { status: 500 }
    )
  }
}