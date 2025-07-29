const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')

const app = express()
const server = createServer(app)

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://localhost:3000",
      "https://127.0.0.1:3000",
      // Add your production domain here when needed
      process.env.FRONTEND_URL
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6, // 1MB
  allowEIO3: true
})

// Middleware
app.use(cors())
app.use(express.json())

// Store active streams and connections
const activeStreams = new Map() // sessionId -> stream data
const connections = new Map() // socketId -> connection data
const viewers = new Map() // sessionId -> Set of socketIds
const broadcasters = new Map() // sessionId -> broadcasterSocketId

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    activeStreams: activeStreams.size,
    totalConnections: connections.size,
    timestamp: new Date().toISOString()
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
    totalActive: streamList.filter(s => s.isLive).length
  })
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id} from ${socket.handshake.address}`)
  
  // Store connection info
  connections.set(socket.id, {
    id: socket.id,
    connectedAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    userAgent: socket.handshake.headers['user-agent'] || 'Unknown',
    address: socket.handshake.address
  })

  // Send server status
  socket.emit('server-status', {
    status: 'connected',
    serverTime: new Date().toISOString(),
    activeStreams: activeStreams.size,
    totalConnections: connections.size
  })

  // Handle heartbeat/ping-pong
  socket.on('heartbeat', (data) => {
    console.log(`💓 Heartbeat from ${socket.id}`)
    const connection = connections.get(socket.id)
    if (connection) {
      connection.lastHeartbeat = new Date().toISOString()
      connections.set(socket.id, connection)
    }
    
    socket.emit('heartbeat-ack', {
      timestamp: new Date().toISOString(),
      serverId: 'livestream-server-1'
    })
  })

  // Handle ping/pong for compatibility
  socket.on('pong', (data) => {
    console.log(`🏓 Pong received from ${socket.id}:`, data?.timestamp)
  })

  // Broadcast stream start
  socket.on('start-broadcast', async (data) => {
    try {
      console.log(`🚀 Start broadcast request from ${socket.id}:`, data)
      
      const sessionId = uuidv4()
      const streamData = {
        sessionId,
        broadcasterId: socket.id,
        streamType: data.streamType || 'webcam',
        startTime: new Date().toISOString(),
        isLive: true,
        metadata: {
          userAgent: data.userAgent,
          resolution: data.resolution,
          clientId: data.clientId,
          fallbackMode: data.fallbackMode || false
        }
      }

      // Store stream data
      activeStreams.set(sessionId, streamData)
      broadcasters.set(sessionId, socket.id)
      viewers.set(sessionId, new Set())

      console.log(`✅ Stream started: ${sessionId} by ${socket.id}`)

      // Confirm to broadcaster
      socket.emit('stream-started', {
        sessionId,
        streamType: streamData.streamType,
        timestamp: streamData.startTime
      })

      // Notify all other clients about new stream
      socket.broadcast.emit('stream-available', {
        sessionId,
        streamType: streamData.streamType,
        timestamp: streamData.startTime
      })

      // Log stream start
      console.log(`📊 Active streams: ${activeStreams.size}, Total connections: ${connections.size}`)

    } catch (error) {
      console.error(`❌ Error starting broadcast for ${socket.id}:`, error)
      socket.emit('stream-error', {
        code: 'BROADCAST_START_FAILED',
        message: 'Failed to start broadcast: ' + error.message
      })
    }
  })

  // Stop broadcast
  socket.on('stop-broadcast', (data) => {
    try {
      console.log(`🛑 Stop broadcast request from ${socket.id}:`, data)
      
      // Find and stop the stream
      let stoppedSessionId = null
      for (const [sessionId, stream] of activeStreams.entries()) {
        if (stream.broadcasterId === socket.id) {
          stoppedSessionId = sessionId
          break
        }
      }

      if (stoppedSessionId) {
        stopStream(stoppedSessionId, socket.id)
      } else {
        console.warn(`⚠️ No active stream found for broadcaster ${socket.id}`)
      }

    } catch (error) {
      console.error(`❌ Error stopping broadcast for ${socket.id}:`, error)
      socket.emit('stream-error', {
        code: 'BROADCAST_STOP_FAILED',
        message: 'Failed to stop broadcast: ' + error.message
      })
    }
  })

  // Join stream as viewer
  socket.on('join-stream', (data) => {
    try {
      console.log(`👀 Viewer join request from ${socket.id}:`, data)
      
      const { sessionId } = data
      
      if (!sessionId) {
        // Auto-join any active stream
        const activeSessionIds = Array.from(activeStreams.keys()).filter(id => 
          activeStreams.get(id)?.isLive
        )
        
        if (activeSessionIds.length > 0) {
          const targetSessionId = activeSessionIds[0] // Join first active stream
          joinViewerToStream(socket, targetSessionId)
        } else {
          socket.emit('stream-error', {
            code: 'NO_ACTIVE_STREAMS',
            message: 'No active streams available'
          })
        }
      } else {
        // Join specific stream
        joinViewerToStream(socket, sessionId)
      }

    } catch (error) {
      console.error(`❌ Error joining stream for ${socket.id}:`, error)
      socket.emit('stream-error', {
        code: 'JOIN_STREAM_FAILED',
        message: 'Failed to join stream: ' + error.message
      })
    }
  })

  // Leave stream
  socket.on('leave-stream', (data) => {
    try {
      console.log(`👋 Viewer leave request from ${socket.id}:`, data)
      removeViewerFromAllStreams(socket.id)
    } catch (error) {
      console.error(`❌ Error leaving stream for ${socket.id}:`, error)
    }
  })

  // WebRTC signaling
  socket.on('stream-offer', (data) => {
    try {
      console.log(`📤 Stream offer from ${socket.id}`)
      const { offer, targetId, sessionId } = data
      
      if (targetId) {
        // Send to specific target
        io.to(targetId).emit('stream-offer', offer)
      } else if (sessionId) {
        // Broadcast to all viewers of this stream
        const streamViewers = viewers.get(sessionId)
        if (streamViewers) {
          streamViewers.forEach(viewerId => {
            if (viewerId !== socket.id) {
              io.to(viewerId).emit('stream-offer', offer)
            }
          })
        }
      } else {
        // Broadcast to all connected clients except sender
        socket.broadcast.emit('stream-offer', offer)
      }
    } catch (error) {
      console.error(`❌ Error handling stream offer from ${socket.id}:`, error)
    }
  })

  socket.on('stream-answer', (data) => {
    try {
      console.log(`📥 Stream answer from ${socket.id}`)
      const { answer, targetId } = data
      
      if (targetId) {
        io.to(targetId).emit('stream-answer', answer)
      } else {
        socket.broadcast.emit('stream-answer', answer)
      }
    } catch (error) {
      console.error(`❌ Error handling stream answer from ${socket.id}:`, error)
    }
  })

  socket.on('ice-candidate', (data) => {
    try {
      const { candidate, targetId, sessionId } = data
      
      if (targetId) {
        // Send to specific target
        io.to(targetId).emit('ice-candidate', candidate)
      } else if (sessionId) {
        // Broadcast to session participants
        const streamViewers = viewers.get(sessionId)
        const broadcasterSocketId = broadcasters.get(sessionId)
        
        // Send to broadcaster if sender is viewer
        if (streamViewers?.has(socket.id) && broadcasterSocketId) {
          io.to(broadcasterSocketId).emit('ice-candidate', candidate)
        }
        
        // Send to viewers if sender is broadcaster
        if (socket.id === broadcasterSocketId && streamViewers) {
          streamViewers.forEach(viewerId => {
            io.to(viewerId).emit('ice-candidate', candidate)
          })
        }
      } else {
        // Broadcast to all
        socket.broadcast.emit('ice-candidate', candidate)
      }
    } catch (error) {
      console.error(`❌ Error handling ICE candidate from ${socket.id}:`, error)
    }
  })

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    try {
      console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`)
      
      // Remove from connections
      connections.delete(socket.id)
      
      // Check if this was a broadcaster
      let broadcastSessionId = null
      for (const [sessionId, broadcasterId] of broadcasters.entries()) {
        if (broadcasterId === socket.id) {
          broadcastSessionId = sessionId
          break
        }
      }
      
      if (broadcastSessionId) {
        console.log(`📺 Broadcaster disconnected, stopping stream: ${broadcastSessionId}`)
        stopStream(broadcastSessionId, socket.id)
      }
      
      // Remove from viewer lists
      removeViewerFromAllStreams(socket.id)
      
      console.log(`📊 Remaining connections: ${connections.size}`)

    } catch (error) {
      console.error(`❌ Error handling disconnection for ${socket.id}:`, error)
    }
  })

  // Error handling
  socket.on('error', (error) => {
    console.error(`❌ Socket error from ${socket.id}:`, error)
  })
})

// Helper function to join viewer to stream
function joinViewerToStream(socket, sessionId) {
  const stream = activeStreams.get(sessionId)
  
  if (!stream || !stream.isLive) {
    socket.emit('stream-error', {
      code: 'STREAM_NOT_FOUND',
      message: 'Stream not found or not active'
    })
    return
  }

  // Add viewer to stream
  if (!viewers.has(sessionId)) {
    viewers.set(sessionId, new Set())
  }
  viewers.get(sessionId).add(socket.id)

  const viewerCount = viewers.get(sessionId).size

  console.log(`✅ Viewer ${socket.id} joined stream ${sessionId} (${viewerCount} viewers)`)

  // Notify viewer of successful join
  socket.emit('stream-joined', {
    sessionId,
    streamType: stream.streamType,
    viewerCount
  })

  // Update viewer count for all participants
  const allParticipants = [...viewers.get(sessionId)]
  const broadcasterSocketId = broadcasters.get(sessionId)
  if (broadcasterSocketId) {
    allParticipants.push(broadcasterSocketId)
  }

  allParticipants.forEach(participantId => {
    io.to(participantId).emit('viewer-count', viewerCount)
  })

  // Send stream offer from broadcaster to new viewer (if broadcaster exists)
  if (broadcasterSocketId) {
    io.to(broadcasterSocketId).emit('new-viewer', {
      viewerId: socket.id,
      sessionId
    })
  }
}

// Helper function to remove viewer from all streams
function removeViewerFromAllStreams(socketId) {
  for (const [sessionId, viewerSet] of viewers.entries()) {
    if (viewerSet.has(socketId)) {
      viewerSet.delete(socketId)
      
      const viewerCount = viewerSet.size
      console.log(`👋 Viewer ${socketId} left stream ${sessionId} (${viewerCount} viewers remaining)`)

      // Update viewer count for remaining participants
      const remainingParticipants = [...viewerSet]
      const broadcasterSocketId = broadcasters.get(sessionId)
      if (broadcasterSocketId) {
        remainingParticipants.push(broadcasterSocketId)
      }

      remainingParticipants.forEach(participantId => {
        io.to(participantId).emit('viewer-count', viewerCount)
      })

      // Clean up empty viewer sets
      if (viewerSet.size === 0) {
        viewers.delete(sessionId)
      }
    }
  }
}

// Helper function to stop a stream
function stopStream(sessionId, broadcasterId) {
  try {
    const stream = activeStreams.get(sessionId)
    if (!stream) {
      console.warn(`⚠️ Attempt to stop non-existent stream: ${sessionId}`)
      return
    }

    console.log(`🛑 Stopping stream: ${sessionId}`)

    // Mark stream as ended
    stream.isLive = false
    stream.endTime = new Date().toISOString()

    // Notify all viewers that stream ended
    const streamViewers = viewers.get(sessionId)
    if (streamViewers) {
      streamViewers.forEach(viewerId => {
        io.to(viewerId).emit('stream-ended', {
          sessionId,
          timestamp: stream.endTime,
          reason: 'Broadcaster stopped the stream'
        })
      })
    }

    // Notify broadcaster
    io.to(broadcasterId).emit('stream-ended', {
      sessionId,
      timestamp: stream.endTime
    })

    // Broadcast to all clients
    io.emit('stream-unavailable', {
      sessionId,
      timestamp: stream.endTime
    })

    // Clean up
    activeStreams.delete(sessionId)
    broadcasters.delete(sessionId)
    viewers.delete(sessionId)

    console.log(`✅ Stream ${sessionId} stopped successfully`)

  } catch (error) {
    console.error(`❌ Error stopping stream ${sessionId}:`, error)
  }
}

// Periodic cleanup of stale connections
setInterval(() => {
  const now = new Date()
  const staleThreshold = 5 * 60 * 1000 // 5 minutes

  for (const [socketId, connection] of connections.entries()) {
    const lastHeartbeat = new Date(connection.lastHeartbeat)
    if (now - lastHeartbeat > staleThreshold) {
      console.log(`🧹 Cleaning up stale connection: ${socketId}`)
      connections.delete(socketId)
      removeViewerFromAllStreams(socketId)
    }
  }
}, 60000) // Run every minute

// Periodic server health broadcast
setInterval(() => {
  io.emit('server-heartbeat', {
    timestamp: new Date().toISOString(),
    activeStreams: activeStreams.size,
    totalConnections: connections.size,
    uptime: process.uptime()
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
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

// Start server
const PORT = process.env.PORT || 3001
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Livestream server running on port ${PORT}`)
  console.log(`📡 Socket.IO server ready for connections`)
  console.log(`🌐 Health check available at http://localhost:${PORT}/health`)
  console.log(`📊 Stream API available at http://localhost:${PORT}/api/streams`)
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`)
})