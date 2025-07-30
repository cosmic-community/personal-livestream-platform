const express = require('express')
const { createServer } = require('http')
const WebSocket = require('ws')
const { v4: uuidv4 } = require('uuid')

const app = express()
const server = createServer(app)

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
  perMessageDeflate: false
})

// Middleware
app.use(express.json())

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Store active streams and connections
const activeStreams = new Map() // sessionId -> stream data
const connections = new Map() // ws -> connection data
const viewers = new Map() // sessionId -> Set of ws

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

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const connectionId = uuidv4()
  console.log(`🔌 New WebSocket connection: ${connectionId}`)
  
  // Store connection info
  connections.set(ws, {
    id: connectionId,
    connectedAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    userAgent: req.headers['user-agent'] || 'Unknown',
    address: req.socket.remoteAddress
  })

  // Send initial connection confirmation
  sendMessage(ws, {
    type: 'connected',
    connectionId,
    serverTime: new Date().toISOString()
  })

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString())
      handleMessage(ws, message)
    } catch (error) {
      console.error('❌ Error parsing message:', error)
      sendMessage(ws, {
        type: 'error',
        message: 'Invalid message format'
      })
    }
  })

  // Handle connection close
  ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed: ${connectionId}, code: ${code}`)
    
    // Clean up connection
    connections.delete(ws)
    
    // Check if this was a broadcaster
    let broadcastSessionId = null
    for (const [sessionId, stream] of activeStreams.entries()) {
      if (stream.broadcasterWs === ws) {
        broadcastSessionId = sessionId
        break
      }
    }
    
    if (broadcastSessionId) {
      console.log(`📺 Broadcaster disconnected, stopping stream: ${broadcastSessionId}`)
      stopStream(broadcastSessionId)
    }
    
    // Remove from viewer lists
    removeViewerFromAllStreams(ws)
  })

  // Handle errors
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for ${connectionId}:`, error)
  })
})

// Handle WebSocket messages
function handleMessage(ws, message) {
  const connection = connections.get(ws)
  if (!connection) {
    console.warn('⚠️ Message from unknown connection')
    return
  }

  console.log(`📨 Message from ${connection.id}:`, message.type)

  switch (message.type) {
    case 'heartbeat':
      connection.lastHeartbeat = new Date().toISOString()
      sendMessage(ws, {
        type: 'heartbeat-ack',
        timestamp: new Date().toISOString()
      })
      break

    case 'start-broadcast':
      handleStartBroadcast(ws, message)
      break

    case 'stop-broadcast':
      handleStopBroadcast(ws, message)
      break

    case 'join-stream':
      handleJoinStream(ws, message)
      break

    case 'leave-stream':
      handleLeaveStream(ws, message)
      break

    default:
      console.warn(`⚠️ Unknown message type: ${message.type}`)
      sendMessage(ws, {
        type: 'error',
        message: `Unknown message type: ${message.type}`
      })
  }
}

// Handle start broadcast
function handleStartBroadcast(ws, message) {
  try {
    const sessionId = uuidv4()
    const streamData = {
      sessionId,
      broadcasterWs: ws,
      streamType: message.streamType || 'webcam',
      startTime: new Date().toISOString(),
      isLive: true,
      metadata: {
        timestamp: message.timestamp,
        userAgent: connections.get(ws)?.userAgent
      }
    }

    // Store stream data
    activeStreams.set(sessionId, streamData)
    viewers.set(sessionId, new Set())

    console.log(`✅ Stream started: ${sessionId}`)

    // Confirm to broadcaster
    sendMessage(ws, {
      type: 'stream-started',
      sessionId,
      streamType: streamData.streamType,
      timestamp: streamData.startTime
    })

    // Notify all other connections about new stream
    broadcast({
      type: 'stream-available',
      sessionId,
      streamType: streamData.streamType,
      timestamp: streamData.startTime
    }, ws)

    console.log(`📊 Active streams: ${activeStreams.size}`)

  } catch (error) {
    console.error('❌ Error starting broadcast:', error)
    sendMessage(ws, {
      type: 'error',
      message: 'Failed to start broadcast: ' + error.message
    })
  }
}

// Handle stop broadcast
function handleStopBroadcast(ws, message) {
  try {
    // Find the stream for this broadcaster
    let sessionId = null
    for (const [id, stream] of activeStreams.entries()) {
      if (stream.broadcasterWs === ws) {
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
    sendMessage(ws, {
      type: 'error',
      message: 'Failed to stop broadcast: ' + error.message
    })
  }
}

// Handle join stream
function handleJoinStream(ws, message) {
  try {
    const { sessionId } = message
    
    // If no sessionId provided, join any active stream
    let targetSessionId = sessionId
    if (!targetSessionId) {
      const activeSessionIds = Array.from(activeStreams.keys()).filter(id => 
        activeStreams.get(id)?.isLive
      )
      if (activeSessionIds.length > 0) {
        targetSessionId = activeSessionIds[0]
      }
    }

    if (!targetSessionId) {
      sendMessage(ws, {
        type: 'error',
        message: 'No active streams available'
      })
      return
    }

    const stream = activeStreams.get(targetSessionId)
    if (!stream || !stream.isLive) {
      sendMessage(ws, {
        type: 'error',
        message: 'Stream not found or not active'
      })
      return
    }

    // Add viewer to stream
    if (!viewers.has(targetSessionId)) {
      viewers.set(targetSessionId, new Set())
    }
    viewers.get(targetSessionId).add(ws)

    const viewerCount = viewers.get(targetSessionId).size

    console.log(`✅ Viewer joined stream ${targetSessionId} (${viewerCount} viewers)`)

    // Notify viewer
    sendMessage(ws, {
      type: 'stream-joined',
      sessionId: targetSessionId,
      streamType: stream.streamType,
      viewerCount
    })

    // Update viewer count for all participants
    updateViewerCount(targetSessionId)

  } catch (error) {
    console.error('❌ Error joining stream:', error)
    sendMessage(ws, {
      type: 'error',
      message: 'Failed to join stream: ' + error.message
    })
  }
}

// Handle leave stream
function handleLeaveStream(ws, message) {
  try {
    removeViewerFromAllStreams(ws)
  } catch (error) {
    console.error('❌ Error leaving stream:', error)
  }
}

// Helper function to send message to a WebSocket
function sendMessage(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error('❌ Error sending message:', error)
      return false
    }
  }
  return false
}

// Helper function to broadcast message to all connections except sender
function broadcast(message, excludeWs = null) {
  let sentCount = 0
  for (const ws of connections.keys()) {
    if (ws !== excludeWs && sendMessage(ws, message)) {
      sentCount++
    }
  }
  console.log(`📡 Broadcasted message to ${sentCount} connections`)
}

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
    streamViewers.forEach(viewerWs => {
      sendMessage(viewerWs, {
        type: 'stream-ended',
        sessionId,
        timestamp: stream.endTime
      })
    })
  }

  // Notify broadcaster
  if (stream.broadcasterWs) {
    sendMessage(stream.broadcasterWs, {
      type: 'stream-ended',
      sessionId,
      timestamp: stream.endTime
    })
  }

  // Broadcast to all
  broadcast({
    type: 'stream-unavailable',
    sessionId,
    timestamp: stream.endTime
  })

  // Clean up
  activeStreams.delete(sessionId)
  viewers.delete(sessionId)

  console.log(`✅ Stream ${sessionId} stopped`)
}

// Helper function to remove viewer from all streams
function removeViewerFromAllStreams(ws) {
  for (const [sessionId, viewerSet] of viewers.entries()) {
    if (viewerSet.has(ws)) {
      viewerSet.delete(ws)
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
  if (stream.broadcasterWs) {
    sendMessage(stream.broadcasterWs, {
      type: 'viewer-count',
      count: viewerCount
    })
  }

  // Notify all viewers
  streamViewers.forEach(viewerWs => {
    sendMessage(viewerWs, {
      type: 'viewer-count',
      count: viewerCount
    })
  })
}

// Periodic cleanup of stale connections
setInterval(() => {
  const now = new Date()
  const staleThreshold = 5 * 60 * 1000 // 5 minutes

  for (const [ws, connection] of connections.entries()) {
    const lastHeartbeat = new Date(connection.lastHeartbeat)
    if (now - lastHeartbeat > staleThreshold) {
      console.log(`🧹 Cleaning up stale connection: ${connection.id}`)
      ws.terminate()
      connections.delete(ws)
      removeViewerFromAllStreams(ws)
    }
  }
}, 60000) // Run every minute

// Periodic server status broadcast
setInterval(() => {
  broadcast({
    type: 'server-status',
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
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

function gracefulShutdown() {
  console.log('🛑 Shutting down gracefully...')
  
  // Close all WebSocket connections
  wss.clients.forEach(ws => {
    ws.close(1000, 'Server shutting down')
  })
  
  // Close server
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
}

// Start server
const PORT = process.env.PORT || 3001
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Livestream server running on port ${PORT}`)
  console.log(`📡 WebSocket server ready at ws://localhost:${PORT}/ws`)
  console.log(`🌐 Health check: http://localhost:${PORT}/health`)
  console.log(`📊 Stream API: http://localhost:${PORT}/api/streams`)
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`)
})