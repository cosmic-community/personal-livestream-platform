import { NextRequest, NextResponse } from 'next/server'
import { getMuxStreamingService } from '@/lib/mux-streaming'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('mux-signature') || ''
    
    const muxStreaming = getMuxStreamingService()
    const isValid = muxStreaming.handleWebhook(JSON.parse(body), signature)
    
    if (!isValid) {
      return NextResponse.json(
        { message: 'Invalid webhook signature' }, 
        { status: 401 }
      )
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { message: 'Webhook processing failed' }, 
      { status: 500 }
    )
  }
}