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
    const { id } = await params
    const body = await request.json()
    const { trackId, languageCode = 'en', name = 'English (generated)' } = body
    
    const muxClient = getMuxClient()
    
    console.log('📝 Generating subtitles for asset:', id, 'track:', trackId)
    
    // Generate subtitles using Mux API
    const result = await muxClient.generateSubtitles(id, trackId, {
      languageCode,
      name,
      passthrough: name
    })
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Failed to generate subtitles:', error)
    return NextResponse.json(
      { error: 'Failed to generate subtitles' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const muxClient = getMuxClient()
    
    // Get asset tracks to see available subtitles
    const tracks = await muxClient.getAssetTracks(id)
    const subtitleTracks = tracks.filter(track => 
      track.type === 'text' || track.type === 'subtitle'
    )
    
    return NextResponse.json({ tracks: subtitleTracks })
    
  } catch (error) {
    console.error('Failed to get subtitle tracks:', error)
    return NextResponse.json(
      { error: 'Failed to get subtitle tracks' },
      { status: 500 }
    )
  }
}