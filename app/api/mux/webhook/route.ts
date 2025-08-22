import { NextRequest, NextResponse } from 'next/server'
import { getMuxStreamingService } from '@/lib/mux-streaming'

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('mux-signature')
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      )
    }

    const body = await request.text()
    const payload = JSON.parse(body)

    console.log('🪝 Received Mux webhook:', payload.type)

    const muxStreaming = getMuxStreamingService()
    const isValid = muxStreaming.handleWebhook(payload, signature)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}