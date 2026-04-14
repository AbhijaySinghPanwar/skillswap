const Message = require('../models/Message');
const Request = require('../models/Request');
const Notification = require('../models/Notification');

// ─── GET /api/messages/:userId ────────────────────────────────────────────────
const getConversation = async (req, res) => {
  try {
    const currentUser = req.userId; // Set by auth middleware
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

// ─── POST /api/messages ───────────────────────────────────────────────────────
const sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const senderId = req.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    // Only allow messaging between users with an accepted swap request
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

    // ── Emit the message via Socket.IO for instant delivery ─────────────────
    const io = req.app.get('socketio');
    if (io) {
      // Send to receiver's personal room
      io.to(receiverId).emit('newMessage', {
        ...populated.toObject(),
        conversationWith: senderId
      });
    }

    // ── Create a notification for the receiver ────────────────────────────
    await Notification.create({
      user: receiverId,
      type: 'message',
      text: `${populated.sender.name} sent you a message`,
      relatedId: message._id
    });
    if (io) {
      const notif = await Notification.findOne({ relatedId: message._id });
      if (notif) io.to(receiverId).emit('newNotification', notif);
    }

    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    console.error('sendMessage error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/messages/contacts ───────────────────────────────────────────────
const getChatContacts = async (req, res) => {
  try {
    const userId = req.userId;

    const acceptedRequests = await Request.find({
      $or: [
        { fromUser: userId, status: 'accepted' },
        { toUser: userId, status: 'accepted' }
      ]
    })
      .populate('fromUser', 'name email isOnline')
      .populate('toUser', 'name email isOnline');

    const contacts = acceptedRequests.map(req => {
      return req.fromUser._id.toString() === userId.toString()
        ? req.toUser
        : req.fromUser;
    });

    // Remove duplicates
    const unique = [...new Map(contacts.map(c => [c._id.toString(), c])).values()];

    res.json({ success: true, contacts: unique });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getConversation, sendMessage, getChatContacts };
