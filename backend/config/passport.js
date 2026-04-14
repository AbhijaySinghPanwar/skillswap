const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

/**
 * Google OAuth 2.0 Strategy
 *
 * Flow:
 * 1. User visits /api/auth/google → Redirected to Google consent screen
 * 2. User grants permission → Google calls /api/auth/google/callback with a profile
 * 3. We find or create a user in MongoDB linked by their googleId
 * 4. The authController.googleCallback issues a JWT and redirects to /dashboard
 *
 * Setup: https://console.cloud.google.com/ → APIs → Credentials → Create OAuth 2.0 Client
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Google profile'), null);
        }

        // ── Try to find an existing user by googleId or email ─────────────────
        let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });

        if (user) {
          // Link the Google account if they previously registered with email/password
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
        } else {
          // ── Create a new OAuth-based user ──────────────────────────────────
          user = await User.create({
            name: profile.displayName || email.split('@')[0],
            email,
            googleId: profile.id,
            avatar: profile.photos?.[0]?.value || '',
            // No password — this user authenticates exclusively with Google
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Minimal serialize/deserialize for session compatibility (not primarily used with JWT approach)
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
