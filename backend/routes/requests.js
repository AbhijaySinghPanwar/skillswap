const express = require('express');
const router = express.Router();
const { sendRequest, getRequests, updateRequest, deleteRequest } = require('../controllers/requestController');
const { isAuthenticated } = require('../middleware/auth');

router.post('/', isAuthenticated, sendRequest);
router.get('/', isAuthenticated, getRequests);
router.put('/:id', isAuthenticated, updateRequest);
router.delete('/:id', isAuthenticated, deleteRequest);

module.exports = router;
