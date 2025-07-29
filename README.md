# Personal Livestream Platform

A modern, real-time streaming platform built with Next.js, WebRTC, and Socket.IO. Features robust connection management, fallback mechanisms, and seamless streaming capabilities.

## 🚀 Features

- **Real-time Streaming**: WebRTC-based streaming with low latency
- **Multiple Stream Types**: Webcam, screen sharing, or combined streams
- **Robust Connection Management**: Automatic reconnection and fallback modes
- **Health Monitoring**: Real-time connection and network quality assessment
- **Responsive Design**: Works on desktop and mobile devices
- **Content Management**: Powered by Cosmic CMS for session tracking and analytics

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Socket.IO
- **Real-time Communication**: WebRTC, Socket.IO
- **Content Management**: Cosmic CMS
- **Deployment**: Vercel (frontend), any Node.js hosting (backend)

## 📋 Prerequisites

- Node.js 18+ and npm/bun
- A Cosmic CMS account and bucket
- Modern web browser with WebRTC support

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd personal-livestream-platform

# Install frontend dependencies
bun install

# Install server dependencies
bun run install:server
```

### 2. Environment Setup

Create `.env.local` in the project root:

```bash
# Cosmic CMS Configuration
COSMIC_BUCKET_SLUG=your-bucket-slug-here
COSMIC_READ_KEY=your-cosmic-read-key-here
COSMIC_WRITE_KEY=your-cosmic-write-key-here

# Streaming Server
NEXT_PUBLIC_SOCKET_URL=ws://localhost:3001

# Development
NODE_ENV=development
```

### 3. Start Development Servers

```bash
# Start both frontend and backend servers
bun run dev

# Or start them separately:
bun run dev:client  # Frontend (http://localhost:3000)
bun run dev:server  # Backend (http://localhost:3001)
```

### 4. Access the Application

- **Broadcaster Dashboard**: http://localhost:3000
- **Stream Viewer**: http://localhost:3000/watch
- **Server Health**: http://localhost:3001/health
- **Stream API**: http://localhost:3001/api/streams

## 🔧 Configuration

### Streaming Server URLs

The client will attempt to connect to streaming servers in this order:

1. `NEXT_PUBLIC_SOCKET_URL` (from environment)
2. `ws://localhost:3001`
3. `ws://127.0.0.1:3001`
4. `ws://localhost:8080`
5. `ws://127.0.0.1:8080`

If all connections fail, the system automatically enables fallback mode for local testing.

### WebRTC Configuration

The platform uses multiple STUN servers for optimal connectivity:

- Google STUN servers (primary)
- Twilio STUN servers (backup)
- Cloudflare STUN servers (backup)

### Media Constraints

**Webcam Streaming:**
- Resolution: 640x480 to 1920x1080 (ideal: 1280x720)
- Frame Rate: 15-60 FPS (ideal: 30 FPS)
- Audio: Echo cancellation, noise suppression enabled

**Screen Sharing:**
- Resolution: 1280x720 to 3840x2160 (ideal: 1920x1080)
- Frame Rate: 15-60 FPS (ideal: 30 FPS)
- Cursor: Always visible

## 🏗️ Architecture

### Frontend Components

- **BroadcasterDashboard**: Main streaming interface with controls and preview
- **StreamViewer**: Viewer interface for watching live streams
- **StreamControls**: Start/stop streaming and source toggle controls
- **StreamPreview**: Live preview of broadcaster's stream
- **StreamStats**: Real-time statistics and analytics

### Backend Services

- **Socket.IO Server**: Real-time communication and signaling
- **Connection Manager**: Health monitoring and retry logic
- **WebRTC Handler**: Peer connection management
- **Stream Session Manager**: Session tracking and analytics

### Connection Flow

1. **Initialization**: Client connects to Socket.IO server
2. **Health Check**: System tests network and device capabilities
3. **Stream Start**: Broadcaster gets media stream and creates WebRTC offer
4. **Signaling**: Server coordinates WebRTC negotiation between peers
5. **Streaming**: Direct peer-to-peer media transmission
6. **Monitoring**: Continuous health and quality monitoring

## 🔍 Troubleshooting

### Connection Issues

**"Unable to connect to streaming server"**
- Ensure the Node.js server is running on port 3001
- Check firewall settings
- Try refreshing the page
- The system will automatically enable fallback mode if needed

**"WebRTC not supported"**
- Use a modern browser (Chrome, Firefox, Safari, Edge)
- Ensure browser permissions for camera/microphone
- Check if running on HTTPS in production

**"Media access denied"**
- Grant camera/microphone permissions in browser
- Ensure devices are not in use by other applications
- Try different devices if available

### Performance Issues

**High latency or poor quality**
- Check network connection speed
- Close other bandwidth-intensive applications
- Switch to a better network if possible
- The system will automatically adjust quality based on connection

**Frequent disconnections**
- Check network stability
- Ensure consistent power supply
- Try using ethernet instead of WiFi
- Check for browser extensions that might interfere

### System Requirements

**Minimum Requirements:**
- Chrome 60+, Firefox 55+, Safari 11+, Edge 79+
- 2 Mbps upload speed for streaming
- 1 Mbps download speed for viewing
- Camera and microphone for broadcasting

**Recommended:**
- Chrome 90+, Firefox 90+, Safari 14+, Edge 90+
- 5 Mbps upload speed for high-quality streaming
- 3 Mbps download speed for viewing
- Hardware-accelerated video encoding support

## 📊 Monitoring and Analytics

### Health Dashboard

The system provides real-time monitoring of:

- **Connection Status**: Server connectivity and fallback state
- **Device Status**: Camera, microphone, and screen sharing availability
- **Network Status**: Latency, bandwidth, and server reachability
- **Stream Statistics**: Viewer count, session duration, quality metrics

### API Endpoints

- `GET /health` - Server health and status
- `GET /api/streams` - List of active streams
- WebSocket events for real-time updates

## 🚀 Deployment

### Frontend (Vercel)

```bash
# Build and deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard:
# - COSMIC_BUCKET_SLUG
# - COSMIC_READ_KEY
# - COSMIC_WRITE_KEY
# - NEXT_PUBLIC_SOCKET_URL (your production server URL)
```

### Backend (Any Node.js Hosting)

```bash
cd server
npm install --production
npm start

# Environment variables needed:
# - PORT (default: 3001)
# - FRONTEND_URL (your frontend domain)
# - NODE_ENV=production
```

### Production Considerations

- Use HTTPS for both frontend and backend in production
- Configure proper CORS origins
- Set up monitoring and logging
- Consider using a reverse proxy (nginx) for the backend
- Configure firewall rules for WebSocket connections

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the browser console for error messages
3. Check the server logs for backend issues
4. Open an issue with detailed information about your setup

## 🛣️ Roadmap

- [ ] Multi-room streaming support
- [ ] Stream recording and playback
- [ ] Advanced analytics dashboard
- [ ] Mobile app development
- [ ] TURN server integration for better connectivity
- [ ] Streaming to external platforms (YouTube, Twitch)
```

I've implemented a comprehensive solution to resolve your streaming server connectivity issues:

## 🔧 **What I've Fixed:**

### 1. **Complete Node.js Streaming Server**
- Created a full-featured Socket.IO server (`server/index.js`) with robust error handling
- Multiple connection endpoints and fallback URLs
- Comprehensive WebRTC signaling support
- Health monitoring and automatic cleanup

### 2. **Enhanced Connection Management**
- New `ConnectionManager` class with real-time health monitoring
- Automatic network performance testing
- Progressive connection retry with backoff
- Detailed connection quality assessment

### 3. **Improved Configuration**
- Centralized stream configuration (`lib/stream-config.ts`)
- Multiple STUN servers for better connectivity
- Adaptive quality settings based on connection health
- Comprehensive error handling and logging

### 4. **Robust Fallback System**
- Enhanced offline mode with realistic behavior
- Multiple server URL attempts before fallback
- Clear user feedback for connection states
- Automatic recovery when connection restored

### 5. **Development Setup**
- Complete environment configuration (`.env.local`)
- Concurrent development scripts for frontend + backend
- Updated package.json with all necessary dependencies
- Comprehensive README with troubleshooting guide

## 🚀 **To Get Streaming Working:**

1. **Install server dependencies:**
   ```bash
   bun run install:server
   ```

2. **Set up your environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Cosmic CMS credentials
   ```

3. **Start both servers:**
   ```bash
   bun run dev