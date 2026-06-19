import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import { setIo } from './socket.js';
import rideRoutes from './routes/rideRoutes.js';
import authRoutes from './routes/authRoutes.js';
import captainRoutes from './routes/captainRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import connectDB from './config/db.js';
import Captain from './models/Captain.js';
import Message from './models/Message.js';

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

const corsOrigin = process.env.FRONTEND_URL || '*';
const corsOptions = {
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: Boolean(process.env.FRONTEND_URL),
};

export const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: Boolean(process.env.FRONTEND_URL),
  },
});

// Expose io to other modules via socket helper (avoids circular imports)
setIo(io);

// Map to track socketId -> { role, id }
const connectedSockets = new Map();
// Track if admin is currently connected
export let adminOnline = false;

io.on('connection', (socket) => {
  socket.on('identify', ({ role, id }) => {
    connectedSockets.set(socket.id, { role, id });
    socket.join(`${role}_${id}`);
    if (role === 'admin') {
      socket.join('admin_room');
      adminOnline = true;
    }
    if (role === 'captain') {
      Captain.findByIdAndUpdate(id, { isOnline: true }).exec();
    }
  });

  socket.on('chat:send', async ({ captainId, text, sender }) => {
    try {
      const msg = await Message.create({ captainId, sender, text });
      io.to('admin_room').emit('chat:message', { captainId, sender, text, createdAt: msg.createdAt });
      io.to(`captain_${captainId}`).emit('chat:message', { captainId, sender, text, createdAt: msg.createdAt });
    } catch {}
  });

  socket.on('ride:chat:send', (msgData) => {
    // msgData contains: rideId, senderId, receiverId, text, timestamp
    // Broadcast to the receiver (could be a user or a captain, so we emit to both potential room names)
    io.to(`user_${msgData.receiverId}`).emit('ride:chat:receive', msgData);
    io.to(`captain_${msgData.receiverId}`).emit('ride:chat:receive', msgData);
  });

  socket.on('captain:location', async ({ captainId, lat, lng }) => {
    await Captain.findByIdAndUpdate(captainId, {
      'location.lat': lat,
      'location.lng': lng,
      'location.updatedAt': new Date(),
    });
    socket.broadcast.emit(`captain:location:${captainId}`, { lat, lng });
  });

  socket.on('disconnect', () => {
    const info = connectedSockets.get(socket.id);
    if (info?.role === 'admin') {
      // Check if any other admin socket is still connected
      const otherAdmin = [...connectedSockets.values()].some(
        (s, key) => key !== socket.id && s.role === 'admin'
      );
      if (!otherAdmin) adminOnline = false;
    }
    connectedSockets.delete(socket.id);
  });

  socket.on('captain:offline', ({ captainId }) => {
    Captain.findByIdAndUpdate(captainId, { isOnline: false }).exec();
  });
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/rides', rideRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/captains', captainRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/chat', chatRoutes);

let PORT = parseInt(process.env.PORT, 10) || 5000;

const startServer = (port) => {
  server.removeAllListeners('error');

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      setTimeout(() => startServer(port + 1), 500);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

startServer(PORT);
