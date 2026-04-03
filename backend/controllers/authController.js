const User = require('../models/User');

// POST /api/auth/signup
const signup = async (req, res) => {
  try {
    const { name, email, password, skillsOffered, skillsWanted, bio } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      skillsOffered: skillsOffered || [],
      skillsWanted: skillsWanted || [],
      bio: bio || ''
    });

    // Set session
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

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Set session
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

// POST /api/auth/logout
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not logout' });
    }
    res.clearCookie('skillswap.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/auth/check
const checkAuth = (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ success: true, loggedIn: true, userId: req.session.userId, userName: req.session.userName });
  }
  res.json({ success: true, loggedIn: false });
};

module.exports = { signup, login, logout, getMe, checkAuth };
