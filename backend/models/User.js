const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  // Password is optional — users who sign in via Google won't have one
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Never returned by default
  },
  // Google OAuth: store the Google account ID for linking
  googleId: {
    type: String,
    default: null,
    sparse: true // Allows multiple null values with unique index
  },
  skillsOffered: {
    type: [String],
    default: []
  },
  skillsWanted: {
    type: [String],
    default: []
  },
  bio: {
    type: String,
    default: '',
    maxlength: [300, 'Bio cannot exceed 300 characters']
  },
  avatar: {
    type: String,
    default: ''
  },
  // Track online/offline status for Socket.IO
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ─── Database Indexes for Performance ─────────────────────────────────────────
// Speeds up skill-based queries and filtering
userSchema.index({ skillsOffered: 1 });
userSchema.index({ skillsWanted: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });

// ─── Hash password before saving ──────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  // Only hash if password is present and was modified
  if (!this.password || !this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Instance Method: Compare Passwords ───────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// ─── Instance Method: Strip Password from JSON ────────────────────────────────
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
