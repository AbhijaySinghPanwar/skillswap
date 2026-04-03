const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Please login to continue' });
};

const isGuest = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.status(400).json({ success: false, message: 'Already logged in' });
  }
  return next();
};

module.exports = { isAuthenticated, isGuest };
