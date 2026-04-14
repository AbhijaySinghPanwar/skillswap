const jwt = require('jsonwebtoken');

/**
 * isAuthenticated middleware
 *
 * Strategy (in order):
 * 1. Verify JWT from HTTP-only cookie `accessToken` (primary — stateless)
 * 2. Fall back to express-session `userId` (legacy compatibility)
 *
 * On success, sets req.userId and req.userName for use in controllers.
 */
const isAuthenticated = (req, res, next) => {
  // ── 1. Try JWT Cookie ──────────────────────────────────────────────────────
  const token = req.cookies?.accessToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      req.userId = decoded.id;
      req.userName = decoded.name;
      return next();
    } catch (err) {
      // Token expired or invalid — fall through to session check
      if (err.name !== 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
      }
    }
  }

  // ── 2. Fallback: Session-based auth ───────────────────────────────────────
  if (req.session && req.session.userId) {
    req.userId = req.session.userId.toString();
    req.userName = req.session.userName;
    return next();
  }

  return res.status(401).json({ success: false, message: 'Please login to continue' });
};

/**
 * isGuest middleware
 * Blocks authenticated users from accessing login/signup pages.
 */
const isGuest = (req, res, next) => {
  const token = req.cookies?.accessToken;
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      return res.status(400).json({ success: false, message: 'Already logged in' });
    } catch (_) {
      // Expired token, let them through
    }
  }
  if (req.session && req.session.userId) {
    return res.status(400).json({ success: false, message: 'Already logged in' });
  }
  return next();
};

module.exports = { isAuthenticated, isGuest };
