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
    
    console.log('🔍 Retrieving Mux live stream:', id)
    
    const stream = await muxClient.getLiveStream(id)
    
    console.log('✅ Stream retrieved successfully')
    
    return NextResponse.json(stream)
  } catch (error) {
    console.error('❌ Failed to get stream:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve stream' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const muxClient = getMuxClient()
    
    console.log('🗑️ Deleting Mux live stream:', id)
    console.warn('⚠️ This will permanently invalidate the stream key')
    
    await muxClient.deleteLiveStream(id)
    
    console.log('✅ Stream deleted - stream key invalidated')
    
    return NextResponse.json({ 
      success: true,
      message: 'Stream deleted successfully',
      streamKeyInvalidated: true
    })
  } catch (error) {
    console.error('❌ Failed to delete stream:', error)
    return NextResponse.json(
      { error: 'Failed to delete stream' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const muxClient = getMuxClient()
    
    console.log('📝 Updating Mux live stream:', id)
    
    let result
    
    switch (body.action) {
      case 'enable':
        result = await muxClient.enableLiveStream(id)
        console.log('✅ Stream enabled')
        break
        
      case 'disable':
        result = await muxClient.disableLiveStream(id)
        console.log('⏹️ Stream disabled')
        break
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "enable" or "disable"' },
          { status: 400 }
        )
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ Failed to update stream:', error)
    return NextResponse.json(
      { error: 'Failed to update stream' },
      { status: 500 }
    )
  }
}