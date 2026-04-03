const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, updateProfile, getMatches } = require('../controllers/userController');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, getAllUsers);
router.get('/matches', isAuthenticated, getMatches);
router.get('/:id', isAuthenticated, getUserById);
router.put('/profile', isAuthenticated, updateProfile);

module.exports = router;
