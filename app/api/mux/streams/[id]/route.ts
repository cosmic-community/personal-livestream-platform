// app/api/mux/streams/[id]/route.ts
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
    
    return NextResponse.json(stream)
  } catch (error) {
    console.error('Error fetching Mux stream:', error)
    return NextResponse.json(
      { message: 'Failed to fetch stream' }, 
      { status: 404 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
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

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const body = await request.json()
    const mux = getMuxClient()
    
    if (body.action === 'enable') {
      const result = await mux.enableLiveStream(id)
      return NextResponse.json(result)
    } else if (body.action === 'disable') {
      const result = await mux.disableLiveStream(id)
      return NextResponse.json(result)
    }
    
    return NextResponse.json(
      { message: 'Invalid action' }, 
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating Mux stream:', error)
    return NextResponse.json(
      { message: 'Failed to update stream' }, 
      { status: 500 }
    )
  }
}