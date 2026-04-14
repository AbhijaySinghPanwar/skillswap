// ─── Load environment variables first ─────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const http = require('http');              // Required to hook Socket.IO onto Express
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const passport = require('./config/passport');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app); // Wrap Express app with Node HTTP server for Socket.IO

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillswap';

// ─── Socket.IO Setup ──────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Expose io to all controllers via app.get('socketio')
app.set('socketio', io);

// ─── Connect to MongoDB ────────────────────────────────────────────────────────
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ─── Security Middleware ───────────────────────────────────────────────────────
// Helmet sets secure HTTP response headers (HSTS, XSS filter, etc.)
app.use(helmet({
  contentSecurityPolicy: false // Disabled so CDN scripts (Bootstrap, JQuery) still load
}));

// Global rate limiter — 150 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter limiter specifically for auth endpoints (prevents brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

app.use('/api/', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// ─── Core Middleware ───────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser()); // Parse JWT cookies from HTTP-only cookies

// Sanitize request data — prevents NoSQL injection attacks ($where, $gt, etc.)
app.use(mongoSanitize());

// ─── Session Configuration (legacy fallback) ───────────────────────────────────
app.use(session({
  name: 'skillswap.sid',
  secret: process.env.SESSION_SECRET || 'skillswap-super-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    ttl: 7 * 24 * 60 * 60
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Initialize Passport (for Google OAuth)
app.use(passport.initialize());

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));

// ─── Frontend HTML Routes ─────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../frontend/login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, '../frontend/signup.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../frontend/dashboard.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, '../frontend/profile.html')));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.status(404).sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Centralized Error Handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.stack);
  // Don't expose stack traces in production
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ─── Socket.IO Real-time Logic ────────────────────────────────────────────────
io.use((socket, next) => {
  // Authenticate socket connections using the JWT from cookie
  // The cookie is sent automatically by browser socket.io clients
  const cookieHeader = socket.handshake.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
  const token = cookies['accessToken'];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = decoded.id;
      socket.userName = decoded.name;
      return next();
    } catch (err) {
      // Allow connection without auth; features requiring userId won't work
    }
  }
  next(); // Allow unauthenticated connection (graceful degradation)
});

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id} (user: ${socket.userId || 'guest'})`);

  // ── Join private room using userId for targeted notifications/messages ──────
  if (socket.userId) {
    socket.join(socket.userId);
    // Mark user as online
    const User = require('./models/User');
    User.findByIdAndUpdate(socket.userId, { isOnline: true }).catch(() => {});

    // Broadcast online status to all connected clients
    io.emit('userStatusChange', { userId: socket.userId, isOnline: true });
  }

  // ── Handle disconnect ─────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (socket.userId) {
      const User = require('./models/User');
      User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: new Date() }).catch(() => {});
      io.emit('userStatusChange', { userId: socket.userId, isOnline: false });
    }
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });

  // ── Client explicitly joins a room (e.g., after userId resolves async) ─────
  socket.on('joinRoom', (userId) => {
    socket.join(userId);
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🚀 SkillSwap server running at http://localhost:${PORT}`);
  console.log(`📡 Socket.IO ready for real-time connections`);
});
