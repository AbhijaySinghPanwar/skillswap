const express = require('express');
const router = express.Router();
const { getConversation, sendMessage, getChatContacts } = require('../controllers/messageController');
const { isAuthenticated } = require('../middleware/auth');

router.get('/contacts', isAuthenticated, getChatContacts);
router.get('/:userId', isAuthenticated, getConversation);
router.post('/', isAuthenticated, sendMessage);

module.exports = router;
