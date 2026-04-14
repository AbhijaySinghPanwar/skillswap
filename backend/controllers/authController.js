const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Token Utilities ──────────────────────────────────────────────────────────

/**
 * Issues a short-lived access token and a long-lived refresh token.
 * Both are stored as HTTP-only cookies to protect against XSS.
 */
const issueTokens = (res, user) => {
  const payload = { id: user._id, name: user.name, email: user.email };

  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m'
  });

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );

  // ── Set access token as HTTP-only cookie ───────────────────────────────────
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  // ── Set refresh token as HTTP-only cookie ──────────────────────────────────
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return { accessToken, refreshToken };
};

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
const signup = async (req, res) => {
  try {
    const { name, email, password, skillsOffered, skillsWanted, bio } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      password,
      skillsOffered: skillsOffered || [],
      skillsWanted: skillsWanted || [],
      bio: bio || ''
    });

    // Issue both JWT tokens and legacy session for compatibility
    issueTokens(res, user);
    req.session.userId = user._id;
    req.session.userName = user.name;

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: user.toJSON()
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Explicitly select password since it's excluded by default
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // OAuth-only user trying to use password login
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'This account uses Google Sign-In. Please use the Google button.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Issue both JWT tokens and legacy session
    issueTokens(res, user);
    req.session.userId = user._id;
    req.session.userName = user.name;

    res.json({
      success: true,
      message: 'Login successful',
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
const logout = (req, res) => {
  // Clear JWT cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  // Also destroy legacy session
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not logout' });
    }
    res.clearCookie('skillswap.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    // req.userId is set by the auth middleware (from JWT or session)
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/auth/check ──────────────────────────────────────────────────────
// NOTE: This route intentionally does NOT use isAuthenticated middleware (no 401 on fail).
// We manually verify the JWT/session here to return a safe loggedIn: true/false response.
const checkAuth = (req, res) => {
  // ── 1. Try JWT from HTTP-only cookie ────────────────────────────────────────
  const token = req.cookies?.accessToken;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      return res.json({
        success: true,
        loggedIn: true,
        userId: decoded.id,
        userName: decoded.name
      });
    } catch (err) {
      // Token invalid/expired — fall through to session check
    }
  }

  // ── 2. Fallback: session-based auth ─────────────────────────────────────────
  if (req.session && req.session.userId) {
    return res.json({
      success: true,
      loggedIn: true,
      userId: req.session.userId,
      userName: req.session.userName
    });
  }

  // ── 3. Not authenticated ─────────────────────────────────────────────────────
  res.json({ success: true, loggedIn: false });
};

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
const refreshToken = (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ success: false, message: 'No refresh token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    // Issue a new access token only
    const accessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
    );
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });
    res.json({ success: true, message: 'Token refreshed' });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

// ─── GET /api/auth/google/callback ────────────────────────────────────────────
// Called by Passport after successful Google OAuth. User is already attached
// to req.user by the GoogleStrategy.
const googleCallback = (req, res) => {
  if (!req.user) {
    return res.redirect('/login?error=oauth_failed');
  }
  // Issue JWT tokens for the OAuth user
  issueTokens(res, req.user);
  // Also set session for full compatibility
  req.session.userId = req.user._id;
  req.session.userName = req.user.name;
  res.redirect('/dashboard');
};

module.exports = { signup, login, logout, getMe, checkAuth, refreshToken, googleCallback };
