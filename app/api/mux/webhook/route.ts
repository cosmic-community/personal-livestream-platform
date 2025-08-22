import { NextRequest, NextResponse } from 'next/server'
import { getMuxStreamingService } from '@/lib/mux-streaming'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('mux-signature') || ''
    
    const payload = JSON.parse(body)
    const muxStreaming = getMuxStreamingService()
    
    const isValid = muxStreaming.handleWebhook(payload, signature)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}