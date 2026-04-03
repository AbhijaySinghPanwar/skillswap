const Request = require('../models/Request');
const User = require('../models/User');

// POST /api/requests - Send a skill exchange request
const sendRequest = async (req, res) => {
  try {
    const { toUser, skillOffered, skillWanted, message } = req.body;
    const fromUser = req.session.userId;

    if (fromUser === toUser) {
      return res.status(400).json({ success: false, message: 'Cannot send request to yourself' });
    }

    // Check if request already exists
    const existingRequest = await Request.findOne({
      fromUser,
      toUser,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ success: false, message: 'You already have a pending request with this user' });
    }

    const request = await Request.create({
      fromUser,
      toUser,
      skillOffered,
      skillWanted,
      message: message || ''
    });

    const populated = await Request.findById(request._id)
      .populate('fromUser', 'name email skillsOffered skillsWanted')
      .populate('toUser', 'name email skillsOffered skillsWanted');

    res.status(201).json({ success: true, message: 'Request sent successfully', request: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/requests - Get all requests for current user
const getRequests = async (req, res) => {
  try {
    const userId = req.session.userId;

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

// PUT /api/requests/:id - Accept or Reject a request
const updateRequest = async (req, res) => {
  try {
    const { status } = req.body;
    const userId = req.session.userId;

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

    res.json({
      success: true,
      message: `Request ${status} successfully`,
      request: populated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/requests/:id - Cancel/delete a request
const deleteRequest = async (req, res) => {
  try {
    const userId = req.session.userId;
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
