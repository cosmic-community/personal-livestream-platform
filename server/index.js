const express = require('express')
const { createServer } = require('http')
const { Server: SocketIOServer } = require('socket.io')
const { v4: uuidv4 } = require('uuid')

const app = express()
const server = createServer(app)

// Create Socket.IO server with enhanced configuration
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  },
  transports: ['websocket'], // Only WebSocket transport
  upgrade: false,
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  allowRequest: (req, callback) => {
    // Allow all connections for development
    callback(null, true)
  }
})

// Middleware
app.use(express.json())

// Enhanced CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  res.header('Access-Control-Allow-Credentials', 'false')
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Store active streams and connections
const activeStreams = new Map() // sessionId -> stream data
const connections = new Map() // socket -> connection data
const viewers = new Map() // sessionId -> Set of sockets

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    activeStreams: activeStreams.size,
    totalConnections: connections.size,
    timestamp: new Date().toISOString(),
    server: 'livestream-websocket',
    version: '1.0.0'
  })
})

// Stream status endpoint
app.get('/api/streams', (req, res) => {
  const streamList = Array.from(activeStreams.entries()).map(([sessionId, stream]) => ({
    sessionId,
    streamType: stream.streamType,
    startTime: stream.startTime,
    viewerCount: viewers.get(sessionId)?.size || 0,
    isLive: stream.isLive
  }))

  res.json({
    streams: streamList,
    totalActive: streamList.filter(s => s.isLive).length,
    serverInfo: {
      uptime: process.uptime(),
      totalConnections: connections.size
    }
  })
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  const connectionId = uuidv4()
  console.log(`🔌 New Socket.IO connection: ${connectionId} (${socket.id})`)
  
  // Store connection info
  connections.set(socket, {
    id: connectionId,
    socketId: socket.id,
    connectedAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    userAgent: socket.handshake.headers['user-agent'] || 'Unknown',
    address: socket.handshake.address
  })

  // Send initial connection confirmation
  socket.emit('connected', {
    connectionId,
    socketId: socket.id,
    serverTime: new Date().toISOString(),
    serverStatus: 'healthy'
  })

  // Enhanced heartbeat handling
  socket.on('heartbeat', (data) => {
    const connection = connections.get(socket)
    if (connection) {
      connection.lastHeartbeat = new Date().toISOString()
      socket.emit('heartbeat-ack', {
        timestamp: new Date().toISOString(),
        latency: data?.timestamp ? Date.now() - data.timestamp : 0
      })
    }
  })

  // Handle start broadcast
  socket.on('start-broadcast', (data) => {
    try {
      const sessionId = uuidv4()
      const streamData = {
        sessionId,
        broadcasterSocket: socket,
        streamType: data.streamType || 'webcam',
        startTime: new Date().toISOString(),
        isLive: true,
        metadata: {
          timestamp: data.timestamp,
          userAgent: connections.get(socket)?.userAgent,
          fallbackMode: data.fallbackMode || false
        }
      }

      // Store stream data
      activeStreams.set(sessionId, streamData)
      viewers.set(sessionId, new Set())

      console.log(`✅ Stream started: ${sessionId} (${streamData.streamType})`)

      // Confirm to broadcaster
      socket.emit('stream-started', {
        sessionId,
        streamType: streamData.streamType,
        timestamp: streamData.startTime
      })

      // Notify all other connections about new stream
      socket.broadcast.emit('stream-available', {
        sessionId,
        streamType: streamData.streamType,
        timestamp: streamData.startTime
      })

      console.log(`📊 Active streams: ${activeStreams.size}`)

    } catch (error) {
      console.error('❌ Error starting broadcast:', error)
      socket.emit('stream-error', {
        code: 'START_BROADCAST_FAILED',
        message: 'Failed to start broadcast: ' + error.message,
        timestamp: new Date().toISOString()
      })
    }
  })

  // Handle stop broadcast
  socket.on('stop-broadcast', (data) => {
    try {
      // Find the stream for this broadcaster
      let sessionId = null
      for (const [id, stream] of activeStreams.entries()) {
        if (stream.broadcasterSocket === socket) {
          sessionId = id
          break
        }
      }

      if (sessionId) {
        stopStream(sessionId)
        console.log(`✅ Stream stopped: ${sessionId}`)
      } else {
        console.warn('⚠️ No active stream found for this broadcaster')
      }

    } catch (error) {
      console.error('❌ Error stopping broadcast:', error)
      socket.emit('stream-error', {
        code: 'STOP_BROADCAST_FAILED',
        message: 'Failed to stop broadcast: ' + error.message,
        timestamp: new Date().toISOString()
      })
    }
  })

  // Handle join stream
  socket.on('join-stream', (data) => {
    try {
      let { sessionId } = data
      
      // If no sessionId provided, join any active stream
      if (!sessionId) {
        const activeSessionIds = Array.from(activeStreams.keys()).filter(id => 
          activeStreams.get(id)?.isLive
        )
        if (activeSessionIds.length > 0) {
          sessionId = activeSessionIds[0]
        }
      }

      if (!sessionId) {
        socket.emit('stream-error', {
          code: 'NO_STREAMS_AVAILABLE',
          message: 'No active streams available',
          timestamp: new Date().toISOString()
        })
        return
      }

      const stream = activeStreams.get(sessionId)
      if (!stream || !stream.isLive) {
        socket.emit('stream-error', {
          code: 'STREAM_NOT_FOUND',
          message: 'Stream not found or not active',
          timestamp: new Date().toISOString()
        })
        return
      }

      // Add viewer to stream
      if (!viewers.has(sessionId)) {
        viewers.set(sessionId, new Set())
      }
      viewers.get(sessionId).add(socket)

      const viewerCount = viewers.get(sessionId).size

      console.log(`✅ Viewer joined stream ${sessionId} (${viewerCount} viewers)`)

      // Notify viewer
      socket.emit('stream-joined', {
        sessionId: sessionId,
        streamType: stream.streamType,
        viewerCount,
        timestamp: new Date().toISOString()
      })

      // Update viewer count for all participants
      updateViewerCount(sessionId)

    } catch (error) {
      console.error('❌ Error joining stream:', error)
      socket.emit('stream-error', {
        code: 'JOIN_STREAM_FAILED',
        message: 'Failed to join stream: ' + error.message,
        timestamp: new Date().toISOString()
      })
    }
  })

  // Handle leave stream
  socket.on('leave-stream', (data) => {
    try {
      removeViewerFromAllStreams(socket)
      socket.emit('stream-left', {
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('❌ Error leaving stream:', error)
    }
  })

  // WebRTC signaling
  socket.on('stream-offer', (data) => {
    console.log(`📡 Relaying WebRTC offer from ${socket.id}`)
    if (data.targetId) {
      socket.to(data.targetId).emit('stream-offer', {
        ...data,
        from: socket.id
      })
    } else {
      socket.broadcast.emit('stream-offer', {
        ...data,
        from: socket.id
      })
    }
  })

  socket.on('stream-answer', (data) => {
    console.log(`📡 Relaying WebRTC answer from ${socket.id}`)
    socket.to(data.targetId).emit('stream-answer', {
      ...data,
      from: socket.id
    })
  })

  socket.on('ice-candidate', (data) => {
    console.log(`📡 Relaying ICE candidate from ${socket.id}`)
    if (data.targetId) {
      socket.to(data.targetId).emit('ice-candidate', {
        ...data,
        from: socket.id
      })
    } else {
      socket.broadcast.emit('ice-candidate', {
        ...data,
        from: socket.id
      })
    }
  })

  // Handle generic messages
  socket.on('message', (data) => {
    console.log(`📨 Message from ${socket.id}:`, data)
    // Echo back or broadcast as needed
  })

  // Handle connection close
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket disconnected: ${connectionId} (${socket.id}), reason: ${reason}`)
    
    // Clean up connection
    connections.delete(socket)
    
    // Check if this was a broadcaster
    let broadcastSessionId = null
    for (const [sessionId, stream] of activeStreams.entries()) {
      if (stream.broadcasterSocket === socket) {
        broadcastSessionId = sessionId
        break
      }
    }
    
    if (broadcastSessionId) {
      console.log(`📺 Broadcaster disconnected, stopping stream: ${broadcastSessionId}`)
      stopStream(broadcastSessionId)
    }
    
    // Remove from viewer lists
    removeViewerFromAllStreams(socket)
  })

  // Handle errors
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${connectionId}:`, error)
  })
})

// Helper function to stop a stream
function stopStream(sessionId) {
  const stream = activeStreams.get(sessionId)
  if (!stream) return

  // Mark stream as ended
  stream.isLive = false
  stream.endTime = new Date().toISOString()

  // Notify all viewers
  const streamViewers = viewers.get(sessionId)
  if (streamViewers) {
    streamViewers.forEach(viewerSocket => {
      viewerSocket.emit('stream-ended', {
        sessionId,
        timestamp: stream.endTime
      })
    })
  }

  // Notify broadcaster
  if (stream.broadcasterSocket) {
    stream.broadcasterSocket.emit('stream-ended', {
      sessionId,
      timestamp: stream.endTime
    })
  }

  // Broadcast to all
  io.emit('stream-unavailable', {
    sessionId,
    timestamp: stream.endTime
  })

  // Clean up
  activeStreams.delete(sessionId)
  viewers.delete(sessionId)

  console.log(`✅ Stream ${sessionId} stopped and cleaned up`)
}

// Helper function to remove viewer from all streams
function removeViewerFromAllStreams(socket) {
  for (const [sessionId, viewerSet] of viewers.entries()) {
    if (viewerSet.has(socket)) {
      viewerSet.delete(socket)
      console.log(`👋 Viewer left stream ${sessionId}`)
      updateViewerCount(sessionId)
    }
  }
}

// Helper function to update viewer count for a stream
function updateViewerCount(sessionId) {
  const stream = activeStreams.get(sessionId)
  const streamViewers = viewers.get(sessionId)
  
  if (!stream || !streamViewers) return

  const viewerCount = streamViewers.size

  // Notify broadcaster
  if (stream.broadcasterSocket) {
    stream.broadcasterSocket.emit('viewer-count', {
      count: viewerCount,
      sessionId,
      timestamp: new Date().toISOString()
    })
  }

  // Notify all viewers
  streamViewers.forEach(viewerSocket => {
    viewerSocket.emit('viewer-count', {
      count: viewerCount,
      sessionId,
      timestamp: new Date().toISOString()
    })
  })
}

// Periodic cleanup of stale connections
setInterval(() => {
  const now = new Date()
  const staleThreshold = 5 * 60 * 1000 // 5 minutes

  for (const [socket, connection] of connections.entries()) {
    const lastHeartbeat = new Date(connection.lastHeartbeat)
    if (now - lastHeartbeat > staleThreshold) {
      console.log(`🧹 Cleaning up stale connection: ${connection.id}`)
      socket.disconnect(true)
      connections.delete(socket)
      removeViewerFromAllStreams(socket)
    }
  }
}, 60000) // Run every minute

// Periodic server status broadcast
setInterval(() => {
  io.emit('server-status', {
    timestamp: new Date().toISOString(),
    activeStreams: activeStreams.size,
    totalConnections: connections.size,
    uptime: process.uptime(),
    serverVersion: '1.0.0'
  })
}, 30000) // Every 30 seconds

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
})

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

function gracefulShutdown() {
  console.log('🛑 Shutting down gracefully...')
  
  // Close all Socket.IO connections
  io.close(() => {
    console.log('✅ Socket.IO server closed')
  })
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ HTTP server closed')
    process.exit(0)
  })
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('⚠️ Forcing shutdown...')
    process.exit(1)
  }, 10000)
}

// Start server
const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || '0.0.0.0'

server.listen(PORT, HOST, () => {
  console.log(`🚀 Livestream WebSocket server running on ${HOST}:${PORT}`)
  console.log(`📡 Socket.IO server ready`)
  console.log(`🌐 Health check: http://${HOST}:${PORT}/health`)
  console.log(`📊 Stream API: http://${HOST}:${PORT}/api/streams`)
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`📦 Socket.IO version: ${require('socket.io/package.json').version}`)
})

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error)
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please use a different port.`)
    process.exit(1)
  }
})