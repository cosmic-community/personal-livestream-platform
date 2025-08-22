// app/api/mux/streams/[id]/subtitles/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getMuxClient } from '@/lib/mux-client'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: assetId } = await params
    const body = await request.json()
    const { trackId, subtitleConfig } = body
    
    const muxClient = getMuxClient()
    
    // Generate subtitles for the asset track
    const subtitles = await muxClient.generateSubtitles(assetId, trackId, {
      languageCode: subtitleConfig?.languageCode || 'en',
      name: subtitleConfig?.name || 'English (generated)',
      passthrough: subtitleConfig?.passthrough || 'English (generated)'
    })
    
    return NextResponse.json(subtitles)
  } catch (error) {
    console.error('Failed to generate subtitles:', error)
    return NextResponse.json(
      { error: 'Failed to generate subtitles' },
      { status: 500 }
    )
  }
}