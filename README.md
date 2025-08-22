# Personal Livestream Platform

A complete live streaming platform built with Next.js, featuring both WebRTC P2P streaming and professional Mux Video streaming capabilities.

## 🚀 Features

### Core Streaming Features
- **Real-time WebRTC Streaming**: Ultra-low latency peer-to-peer streaming
- **Professional Mux Video**: Enterprise-grade streaming with global CDN
- **Stream Preview**: Live preview of your stream before going live
- **Multiple Stream Types**: Webcam, screen share, or both simultaneously
- **Viewer Management**: Real-time viewer count and connection management
- **Stream Sharing**: Generate shareable links for viewers

### Technical Features
- **Next.js 15**: Modern React framework with App Router
- **TypeScript**: Full type safety throughout the application
- **WebSocket Signaling**: Real-time communication for WebRTC
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Comprehensive error management and recovery
- **Fallback Modes**: Graceful degradation when services are unavailable

## 🏗️ Architecture

### Streaming Modes
1. **WebRTC Mode**: Direct peer-to-peer streaming for minimal latency
2. **Mux Mode**: Professional streaming through Mux Video infrastructure

### Components
- **SimpleDashboard**: Main streaming dashboard for broadcasters
- **StreamViewer**: Component for watching WebRTC streams  
- **MuxLivePlayer**: Professional video player for Mux streams
- **MuxStreamingDashboard**: Advanced Mux stream management

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
# Install all dependencies
bun install

# Install server dependencies
cd server && bun install
```

### 2. Environment Variables
Create `.env.local` in the root directory:

```env
# Cosmic CMS (for content management)
COSMIC_BUCKET_SLUG=your-bucket-slug-here
COSMIC_READ_KEY=your-cosmic-read-key-here  
COSMIC_WRITE_KEY=your-cosmic-write-key-here

# Mux Video (for professional streaming)
MUX_TOKEN_ID=your-mux-token-id
MUX_TOKEN_SECRET=your-mux-token-secret
MUX_WEBHOOK_SECRET=your-webhook-secret

# WebSocket Server
NEXT_PUBLIC_SOCKET_URL=ws://localhost:3001

# Development
NODE_ENV=development
NEXT_PUBLIC_DEBUG_STREAMING=true
```

### 3. Start the Application

**Terminal 1 - WebSocket Server:**
```bash
cd server
bun run dev
```

**Terminal 2 - Next.js App:**
```bash
bun run dev
```

### 4. Access the Application
- **Main Dashboard**: http://localhost:3000
- **Stream Viewer**: http://localhost:3000/watch
- **WebSocket Server**: http://localhost:3001

## 📺 How to Stream

### Starting a Stream
1. Open the main dashboard at http://localhost:3000
2. Choose your stream type:
   - **📷 Webcam**: Stream from your camera
   - **🖥️ Screen**: Share your screen
   - **📹 Both**: Camera + screen simultaneously
3. Click the stream type button to start
4. Grant camera/screen permissions when prompted
5. Your stream preview will appear

### Sharing Your Stream
1. Once live, click the "Share Stream" button
2. Copy the generated viewer URL
3. Share the URL with viewers
4. Viewers can watch at: http://localhost:3000/watch?stream=SESSION_ID

### For Mux Streaming
1. Configure Mux credentials in environment variables
2. Use the MuxStreamingDashboard component
3. Create a Mux stream and get RTMP credentials
4. Use OBS Studio or similar software to stream
5. Viewers watch using the Mux playback ID

## 🔧 Configuration

### WebRTC Configuration
Edit `lib/stream-config.ts` for WebRTC settings:
- ICE servers (STUN/TURN)
- Connection timeouts and retries
- Media constraints (video/audio quality)

### Mux Configuration  
Configure Mux settings in your environment:
- Token ID and Secret from Mux Dashboard
- Webhook endpoints for stream events
- Playback policies and settings

## 🎯 Usage Examples

### WebRTC Stream URL Format
```
http://localhost:3000/watch?stream=SESSION_ID&mode=webrtc
```

### Mux Stream URL Format  
```
http://localhost:3000/watch?id=PLAYBACK_ID&mode=mux
```

### Embed Stream Player
```jsx
import MuxLivePlayer from '@/components/MuxLivePlayer'

<MuxLivePlayer 
  playbackId="your-playback-id"
  autoPlay={true}
  showViewerCount={true}
/>
```

## 🧪 Development

### Running Tests
```bash
bun run test
```

### Type Checking
```bash
bun run type-check
```

### Building for Production
```bash
bun run build
```

## 📚 API Endpoints

### Mux Streams
- `POST /api/mux/streams` - Create new stream
- `GET /api/mux/streams` - List all streams  
- `GET /api/mux/streams/[id]` - Get stream details
- `DELETE /api/mux/streams/[id]` - Delete stream
- `GET /api/mux/streams/[id]/status` - Get stream status

### WebSocket Events
- `start-broadcast` - Begin streaming
- `stop-broadcast` - End streaming  
- `join-stream` - Join as viewer
- `viewer-count` - Real-time viewer updates

## 🔒 Security Considerations

### Stream Keys
- Treat Mux stream keys as passwords
- Never share stream keys publicly
- Reset keys if compromised
- Store keys securely (password manager recommended)

### WebRTC Security
- Uses HTTPS in production for secure media access
- ICE candidates filtered for security
- Connection state monitoring for unauthorized access

## 🚀 Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment
```bash
bun run build
bun run start
```

### WebSocket Server Deployment
Deploy the `server/` directory to a Node.js hosting service:
- Railway, Heroku, Digital Ocean, etc.
- Update `NEXT_PUBLIC_SOCKET_URL` to production WebSocket URL

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with proper TypeScript types
4. Test thoroughly on both desktop and mobile
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

### Common Issues

**Stream Preview Not Working**
- Check camera/microphone permissions
- Verify WebSocket server is running on port 3001
- Check browser console for WebRTC errors

**Viewers Can't Connect**  
- Ensure WebSocket server is accessible
- Check firewall settings for port 3001
- Verify stream URL format is correct

**Mux Streams Not Working**
- Verify Mux credentials in environment variables
- Check Mux webhook configuration
- Ensure RTMP stream is properly configured

### Getting Help
- Check the browser console for errors
- Review server logs for WebSocket issues
- Test with multiple browsers/devices
- Verify all environment variables are set correctly

---

Built with ❤️ using Next.js, WebRTC, and Mux Video