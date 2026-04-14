const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // The user who RECEIVES this notification
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Query by recipient user quickly
  },
  // Type of event that triggered this notification
  type: {
    type: String,
    enum: ['request_received', 'request_accepted', 'request_rejected', 'message'],
    required: true
  },
  // Human-readable message body
  text: {
    type: String,
    required: true
  },
  // Optional reference to the related document (request ID, message ID, etc.)
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  // Tracks if the user has seen this notification
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true // Sort by most recent
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
