const express = require('express');
const router = express.Router();
const { signup, login, logout, getMe, checkAuth } = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/auth');

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', isAuthenticated, getMe);
router.get('/check', checkAuth);

module.exports = router;
