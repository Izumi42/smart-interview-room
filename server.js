const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const db = require('./src/db');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Attach Socket.io to the server
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Rooms state is now managed entirely by db.js for persistence

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join-room', (data) => {
      let roomId = data;
      let sessionId = socket.id;
      if (typeof data === 'object') {
        roomId = data.roomId;
        sessionId = data.sessionId || socket.id;
      }

      socket.join(roomId);
      console.log(`${socket.id} joined room: ${roomId} with session: ${sessionId}`);
      
      // DB Persistence: Ensure room exists and send history
      db.ensureRoom(roomId, sessionId);
      const adminSessionId = db.getRoomAdmin(roomId);
      const isAdmin = (adminSessionId === sessionId);
      
      socket.emit('room-joined', { isAdmin });

      const agenda = db.getAgendaItems(roomId);
      socket.emit('room-history', { transcripts: [], agenda });

      // Notify others in the room
      socket.to(roomId).emit('user-connected', socket.id);
    });

    socket.on('disconnecting', () => {
      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          socket.to(room).emit('user-disconnected', socket.id);
        }
      });
    });

    socket.on('disconnect', () => {
      console.log(`${socket.id} disconnected`);
    });

    socket.on('offer', (payload) => {
      io.to(payload.target).emit('offer', payload);
    });

    socket.on('answer', (payload) => {
      io.to(payload.target).emit('answer', payload);
    });

    socket.on('ice-candidate', (incoming) => {
      io.to(incoming.target).emit('ice-candidate', incoming);
    });

    // New Google Meet Clone Features
    socket.on('chat-message', (payload) => {
      // payload: { roomId, message, senderId, senderName, timestamp }
      io.to(payload.roomId).emit('chat-message', payload);
    });

    socket.on('raise-hand', (payload) => {
      // payload: { roomId, userId }
      io.to(payload.roomId).emit('raise-hand', payload);
    });

    socket.on('toggle-media', (payload) => {
      // payload: { roomId, userId, type: 'video' | 'audio', isEnabled: boolean }
      socket.to(payload.roomId).emit('toggle-media', payload);
    });

    socket.on('transcript', (payload) => {
      // payload: { id, roomId, senderName, text, isFinal, timestamp }
      // Conversations are ephemeral; not saved to database
      io.to(payload.roomId).emit('transcript', payload);
    });

    // DB Persistence for Agenda & Scorecards
    socket.on('add-agenda', (payload) => {
      // payload: { id, roomId, text, done }
      db.saveAgendaItem(payload);
      io.to(payload.roomId).emit('add-agenda', payload);
    });

    socket.on('toggle-agenda', (payload) => {
      // payload: { id, roomId, text, done }
      db.saveAgendaItem(payload);
      io.to(payload.roomId).emit('toggle-agenda', payload);
    });


  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
