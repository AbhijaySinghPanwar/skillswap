const Request = require('../models/Request');
const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Helper: creates a Notification doc and emits it via Socket.IO in real-time.
 * Falls back gracefully if io isn't available.
 */
const createAndEmitNotification = async (app, { userId, type, text, relatedId }) => {
  try {
    const notification = await Notification.create({ user: userId, type, text, relatedId });
    // Emit to the recipient's private room (they join using their userId on connection)
    const io = app.get('socketio');
    if (io) {
      io.to(userId.toString()).emit('newNotification', notification);
    }
    return notification;
  } catch (err) {
    console.error('Notification creation failed:', err.message);
  }
};

// ─── POST /api/requests ───────────────────────────────────────────────────────
const sendRequest = async (req, res) => {
  try {
    const { toUser, skillOffered, skillWanted, message } = req.body;
    const fromUser = req.userId; // Set by JWT/session middleware

    if (fromUser === toUser) {
      return res.status(400).json({ success: false, message: 'Cannot send request to yourself' });
    }

    const existingRequest = await Request.findOne({ fromUser, toUser, status: 'pending' });
    if (existingRequest) {
      return res.status(400).json({ success: false, message: 'You already have a pending request with this user' });
    }

    const request = await Request.create({ fromUser, toUser, skillOffered, skillWanted, message: message || '' });

    const populated = await Request.findById(request._id)
      .populate('fromUser', 'name email skillsOffered skillsWanted')
      .populate('toUser', 'name email skillsOffered skillsWanted');

    // ── Notify the recipient in real-time ─────────────────────────────────────
    await createAndEmitNotification(req.app, {
      userId: toUser,
      type: 'request_received',
      text: `${populated.fromUser.name} sent you a skill swap request (${skillOffered} ↔ ${skillWanted})`,
      relatedId: request._id
    });

    res.status(201).json({ success: true, message: 'Request sent successfully', request: populated });
  } catch (error) {
    console.error('sendRequest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/requests ────────────────────────────────────────────────────────
const getRequests = async (req, res) => {
  try {
    const userId = req.userId;

    const sent = await Request.find({ fromUser: userId })
      .populate('toUser', 'name email skillsOffered skillsWanted')
      .sort({ createdAt: -1 });

    const received = await Request.find({ toUser: userId })
      .populate('fromUser', 'name email skillsOffered skillsWanted')
      .sort({ createdAt: -1 });

    res.json({ success: true, sent, received });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── PUT /api/requests/:id ────────────────────────────────────────────────────
const updateRequest = async (req, res) => {
  try {
    const { status } = req.body;
    const userId = req.userId;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    if (request.toUser.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this request' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request has already been processed' });
    }

    request.status = status;
    await request.save();

    const populated = await Request.findById(request._id)
      .populate('fromUser', 'name email')
      .populate('toUser', 'name email');

    // ── Notify the original sender about the outcome ───────────────────────
    const notifType = status === 'accepted' ? 'request_accepted' : 'request_rejected';
    const notifText = status === 'accepted'
      ? `${populated.toUser.name} accepted your skill swap request! 🎉`
      : `${populated.toUser.name} declined your skill swap request.`;

    await createAndEmitNotification(req.app, {
      userId: request.fromUser.toString(),
      type: notifType,
      text: notifText,
      relatedId: request._id
    });

    res.json({ success: true, message: `Request ${status} successfully`, request: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── DELETE /api/requests/:id ─────────────────────────────────────────────────
const deleteRequest = async (req, res) => {
  try {
    const userId = req.userId;
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    if (request.fromUser.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await request.deleteOne();
    res.json({ success: true, message: 'Request cancelled' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { sendRequest, getRequests, updateRequest, deleteRequest };
