const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const {
  signup, login, logout, getMe, checkAuth, refreshToken, googleCallback
} = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/auth');
const { validate, signupSchema, loginSchema } = require('../middleware/validate');

// ─── Standard Auth ────────────────────────────────────────────────────────────
router.post('/signup', validate(signupSchema), signup);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', isAuthenticated, getMe);
router.get('/check', checkAuth);
router.post('/refresh', refreshToken);

// ─── Google OAuth 2.0 ────────────────────────────────────────────────────────
// Step 1: Redirect user to Google's consent screen
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// Step 2: Google sends user back here with an auth code
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=oauth_failed', session: false }),
  googleCallback
);

module.exports = router;
