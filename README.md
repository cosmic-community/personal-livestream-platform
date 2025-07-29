# Personal Livestream Platform

![App Preview](https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1200&h=300&fit=crop&auto=format)

A simple yet powerful personal livestreaming web application designed for solo broadcasters. Go live instantly with your webcam or screen share, featuring real-time streaming with low latency using WebRTC technology.

## Features

- 🎥 **One-Click Live Streaming** - Instant broadcasting with webcam or screen share
- 🔄 **Real-Time WebRTC Streaming** - Low latency live streaming for immediate engagement
- 📱 **Flexible Source Control** - Toggle between webcam and screen sharing seamlessly
- 👀 **Public Viewing Experience** - No-login required viewing page accessible to anyone
- 🔴 **Live Status Indicators** - Clear visual feedback showing broadcast status
- 📺 **Responsive Video Player** - Adaptive streaming that works on all devices
- 📊 **Stream Analytics** - Track viewer counts and broadcast history via Cosmic CMS

## Clone this Bucket and Code Repository

Want to create your own version of this project with all the content and structure? Clone this Cosmic bucket and code repository to get started instantly:

[![Clone this Bucket and Code Repository](https://img.shields.io/badge/Clone%20this%20Bucket-29abe2?style=for-the-badge&logo=cosmic&logoColor=white)](https://app.cosmic-staging.com/projects/new?clone_bucket=6888e0ab2dcc7fbc00c94e31&clone_repository=6888e3762dcc7fbc00c94e33)

## Prompts

This application was built using the following prompts to generate the content structure and code:

### Content Model Prompt

> No content model prompt provided - app built from existing content structure

### Code Generation Prompt

> Build a simple livestreaming web application for personal use. I want to be the only broadcaster. The app should have the following core features: A "Go Live" button that lets me start a livestream using either my webcam or screen share. Toggle buttons to switch webcam and screen sharing on or off. A public viewing page where users can watch the livestream (no login needed). The stream should be live in real time with low latency, ideally using WebRTC or similar. Include basic start/stop stream functionality and a simple UI to show whether I am live. This is a solo use case (no chat, no multi-user broadcasting). Keep the UI and backend as simple as possible.

The app has been tailored to work with your existing Cosmic content structure and includes all the features requested above.

## Technologies Used

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **WebRTC** - Real-time communication for low-latency streaming
- **Socket.io** - Real-time bidirectional communication
- **Cosmic CMS** - Content management and analytics storage
- **Node.js** - Server-side streaming infrastructure

## Prerequisites

- Node.js 18+ or Bun
- A Cosmic account and bucket
- Modern web browser with WebRTC support

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   bun install
   ```

3. Set up your environment variables:
   ```env
   COSMIC_BUCKET_SLUG=your-bucket-slug
   COSMIC_READ_KEY=your-read-key
   COSMIC_WRITE_KEY=your-write-key
   ```

4. Run the development server:
   ```bash
   bun dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) to access the broadcaster dashboard
6. Share [http://localhost:3000/watch](http://localhost:3000/watch) for public viewing

## Cosmic SDK Examples

### Recording Stream Sessions
```javascript
// Store stream session data
const session = await cosmic.objects.insertOne({
  type: 'stream-sessions',
  title: `Stream Session ${new Date().toISOString()}`,
  metadata: {
    start_time: new Date().toISOString(),
    stream_type: 'webcam', // or 'screen'
    viewer_count: 0,
    duration: 0,
    status: 'live'
  }
})
```

### Updating Viewer Analytics
```javascript
// Update viewer count in real-time
await cosmic.objects.updateOne(sessionId, {
  metadata: {
    viewer_count: currentViewerCount,
    peak_viewers: Math.max(peakViewers, currentViewerCount)
  }
})
```

## Cosmic CMS Integration

The application uses Cosmic to store:

- **Stream Sessions** - Track all your broadcast sessions with timestamps and analytics
- **Viewer Analytics** - Monitor real-time and historical viewer data
- **Stream Settings** - Save your preferred streaming configurations
- **Broadcast History** - Maintain a record of all your streaming activity

This provides valuable insights into your streaming performance while keeping the interface simple and focused.

## Getting Started

### For Broadcasters
1. Navigate to the main dashboard at `/`
2. Click "Go Live" to start your stream
3. Choose between webcam or screen sharing
4. Toggle sources on/off as needed during your stream
5. Click "Stop Stream" when finished

### For Viewers
1. Visit the public viewing page at `/watch`
2. If a stream is live, it will automatically start playing
3. No account or login required

## Deployment Options

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add your Cosmic environment variables in the Vercel dashboard
3. Deploy with automatic HTTPS and global CDN

### Netlify
1. Connect your repository to Netlify
2. Set build command: `bun run build`
3. Add environment variables in Netlify dashboard

### Environment Variables for Production
Set these in your hosting platform:
- `COSMIC_BUCKET_SLUG`
- `COSMIC_READ_KEY` 
- `COSMIC_WRITE_KEY`

<!-- README_END -->