const Message = require('../models/Message');
const Request = require('../models/Request');

// GET /api/messages/:userId - Get conversation with a user
const getConversation = async (req, res) => {
  try {
    const currentUser = req.session.userId;
    const otherUser = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: currentUser, receiver: otherUser },
        { sender: otherUser, receiver: currentUser }
      ]
    })
      .populate('sender', 'name')
      .populate('receiver', 'name')
      .sort({ createdAt: 1 });

    // Mark received messages as read
    await Message.updateMany(
      { sender: otherUser, receiver: currentUser, read: false },
      { read: true }
    );

    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/messages - Send a message
const sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const senderId = req.session.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    // Check if users have an accepted request between them
    const acceptedRequest = await Request.findOne({
      $or: [
        { fromUser: senderId, toUser: receiverId, status: 'accepted' },
        { fromUser: receiverId, toUser: senderId, status: 'accepted' }
      ]
    });

    if (!acceptedRequest) {
      return res.status(403).json({
        success: false,
        message: 'You can only message users who have accepted your request'
      });
    }

    const message = await Message.create({
      sender: senderId,
      receiver: receiverId,
      content: content.trim()
    });

    const populated = await Message.findById(message._id)
      .populate('sender', 'name')
      .populate('receiver', 'name');

    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/messages/contacts - Get all users I can chat with (accepted requests)
const getChatContacts = async (req, res) => {
  try {
    const userId = req.session.userId;

    const acceptedRequests = await Request.find({
      $or: [
        { fromUser: userId, status: 'accepted' },
        { toUser: userId, status: 'accepted' }
      ]
    })
      .populate('fromUser', 'name email')
      .populate('toUser', 'name email');

    const contacts = acceptedRequests.map(req => {
      const contact = req.fromUser._id.toString() === userId.toString()
        ? req.toUser
        : req.fromUser;
      return contact;
    });

    // Remove duplicates
    const unique = [...new Map(contacts.map(c => [c._id.toString(), c])).values()];

    res.json({ success: true, contacts: unique });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getConversation, sendMessage, getChatContacts };
