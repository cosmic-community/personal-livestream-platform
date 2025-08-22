# Personal Livestream Platform

A modern personal live streaming application built with Next.js 15, Mux Video, and TypeScript. Stream directly from your browser or use professional broadcasting software like OBS Studio.

## Features

- 🎥 **Professional Live Streaming** - Powered by Mux Video API
- 📱 **Browser-based Broadcasting** - Stream directly from your browser
- 🎛️ **OBS Studio Integration** - Use professional broadcasting software
- 🔒 **Secure Stream Keys** - Private, secure streaming credentials
- 📊 **Real-time Analytics** - Monitor viewer count and stream statistics
- 🎨 **Modern UI** - Clean, responsive interface built with Tailwind CSS
- 🔄 **Real-time Updates** - WebSocket-powered live updates
- 📹 **HLS Playback** - High-quality video streaming with automatic quality adjustment

## Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Mux Video account with API credentials
- Cosmic CMS bucket (optional, for content management)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd personal-livestream-platform
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` with your credentials:
   ```env
   # Mux Video Configuration
   MUX_TOKEN_ID=your-mux-token-id
   MUX_TOKEN_SECRET=your-mux-token-secret
   
   # Cosmic CMS Configuration (optional)
   COSMIC_BUCKET_SLUG=your-bucket-slug
   COSMIC_READ_KEY=your-read-key
   COSMIC_WRITE_KEY=your-write-key
   
   # Server Configuration
   NEXT_PUBLIC_SOCKET_URL=ws://localhost:3001
   ```

4. **Start the development servers**
   
   Terminal 1 (Next.js frontend):
   ```bash
   bun run dev
   ```
   
   Terminal 2 (WebSocket server):
   ```bash
   cd server
   bun install
   bun run dev
   ```

5. **Open your browser**
   - Frontend: http://localhost:3000
   - WebSocket server: http://localhost:3001

## Usage

### Creating Your First Stream

1. **Navigate to the Dashboard**
   - Open http://localhost:3000 in your browser
   - Click "Create New Stream" to generate a new streaming endpoint

2. **Get Your Stream Credentials**
   - Copy the RTMP server URL and stream key
   - **Important**: Keep your stream key private and secure

3. **Start Streaming**
   
   **Option A: Browser Streaming**
   - Use the built-in browser streaming controls
   - Grant camera/microphone permissions when prompted
   
   **Option B: OBS Studio**
   - Open OBS Studio
   - Go to Settings > Stream
   - Set Service to "Custom"
   - Enter the RTMP server URL and stream key
   - Click "Start Streaming"

4. **Watch Your Stream**
   - Navigate to the watch page or use the HLS URL provided
   - Share the watch page URL with viewers

### Stream Management

- **View All Streams**: See all your created streams in the dashboard
- **Delete Streams**: Remove old or unused streams
- **Reset Stream Keys**: Generate new stream keys if compromised
- **Monitor Analytics**: View viewer count and stream statistics

## Architecture

### Frontend (Next.js 15)
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict type checking
- **Styling**: Tailwind CSS with custom components
- **State Management**: React hooks with custom streaming hooks
- **Video**: Mux Video API integration with HLS.js

### Backend Services
- **Streaming**: Mux Video API for live stream management
- **WebSocket**: Socket.IO server for real-time communication
- **Content**: Cosmic CMS for metadata and content management

### Key Components

- `MuxStreamingDashboard` - Main dashboard for stream management
- `MuxVideoPlayer` - HLS video player with Mux integration
- `useMux` - React hook for Mux API operations
- `MuxClient` - Mux API client with enhanced security features

## Security Features

### Stream Key Protection
- Stream keys are treated as sensitive credentials
- Automatic security warnings and best practice reminders
- Option to hide/show stream keys in the interface
- Easy stream key reset functionality

### Best Practices Enforced
- Never log full stream keys in console
- Secure clipboard operations for copying credentials
- Visual warnings about stream key privacy
- Automatic cleanup of disconnected streams

## API Routes

### Mux Integration
- `POST /api/mux/streams` - Create new live stream
- `GET /api/mux/streams` - List all streams
- `GET /api/mux/streams/[id]` - Get specific stream details
- `DELETE /api/mux/streams/[id]` - Delete stream
- `GET /api/mux/streams/[id]/status` - Get stream status
- `POST /api/mux/webhook` - Handle Mux webhooks

## Configuration

### Environment Variables

```env
# Mux Video (Required)
MUX_TOKEN_ID=your-mux-token-id
MUX_TOKEN_SECRET=your-mux-token-secret

# Optional: Enhanced Mux features
MUX_WEBHOOK_SECRET=your-webhook-secret
MUX_SIGNING_KEY_ID=your-signing-key-id
MUX_SIGNING_KEY_SECRET=your-signing-key-secret

# Cosmic CMS (Optional)
COSMIC_BUCKET_SLUG=your-bucket-slug
COSMIC_READ_KEY=your-read-key
COSMIC_WRITE_KEY=your-write-key

# Server Configuration
NEXT_PUBLIC_SOCKET_URL=ws://localhost:3001
PORT=3001
FRONTEND_URL=http://localhost:3000

# Development
NODE_ENV=development
NEXT_PUBLIC_DEBUG_STREAMING=true
```

### Streaming Settings

Default stream configuration:
- **Playback Policy**: Public (no authentication required)
- **Reduced Latency**: Enabled (low-latency streaming)
- **Reconnect Window**: 60 seconds
- **MP4 Support**: Standard quality recordings
- **Audio Normalization**: Enabled

## Deployment

### Vercel (Recommended)

1. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

2. **Set Environment Variables**
   - Add all required environment variables in Vercel dashboard
   - Update `NEXT_PUBLIC_SOCKET_URL` to your WebSocket server URL

3. **Deploy WebSocket Server**
   - Deploy the `server/` directory to a service like Railway, Render, or Heroku
   - Update the WebSocket URL in your environment variables

### Other Platforms

The application can be deployed to any platform that supports:
- Next.js applications
- Node.js WebSocket servers
- Environment variable configuration

## Development

### Scripts

```bash
# Frontend development
bun run dev          # Start Next.js dev server
bun run build        # Build for production
bun run start        # Start production server
bun run lint         # Run ESLint
bun run type-check   # Run TypeScript checks

# WebSocket server (in server/ directory)
bun run dev          # Start development server with nodemon
bun run start        # Start production server
```

### Code Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── watch/             # Stream viewer page
│   └── page.tsx           # Main dashboard
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
├── server/                # WebSocket server
└── types/                 # TypeScript definitions
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Create an issue on GitHub for bugs or feature requests
- **Mux Support**: Visit [Mux Documentation](https://docs.mux.com/) for API help

## Acknowledgments

- **Mux Video** - Professional video streaming infrastructure
- **Next.js** - React framework for production applications
- **Socket.IO** - Real-time WebSocket communication
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe JavaScript development