const User = require('../models/User');
const Request = require('../models/Request');

// ─── GET /api/users ───────────────────────────────────────────────────────────
// Supports pagination via ?page=1&limit=12
const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    // Total count for pagination metadata
    const totalUsers = await User.countDocuments({ _id: { $ne: req.userId } });
    const totalPages = Math.ceil(totalUsers / limit);

    const users = await User.find({ _id: { $ne: req.userId } })
      .select('-password')
      .skip(skip)
      .limit(limit)
      .lean(); // lean() returns plain JS objects — faster for read-only ops

    // Compute match scores for current page users
    const currentUser = await User.findById(req.userId).lean();

    const usersWithMatch = users.map(user => {
      if (currentUser) {
        const myOffered = currentUser.skillsOffered.map(s => s.toLowerCase());
        const myWanted = currentUser.skillsWanted.map(s => s.toLowerCase());
        const theirOffered = user.skillsOffered.map(s => s.toLowerCase());
        const theirWanted = user.skillsWanted.map(s => s.toLowerCase());

        const theyOfferWhatIWant = myWanted.filter(s => theirOffered.includes(s)).length;
        const theyWantWhatIOffer = myOffered.filter(s => theirWanted.includes(s)).length;
        const totalPossible = Math.max(myWanted.length + myOffered.length, 1);

        user.matchScore = Math.min(100, Math.round(
          ((theyOfferWhatIWant + theyWantWhatIOffer) / totalPossible) * 100
        ));
      } else {
        user.matchScore = 0;
      }
      return user;
    });

    // Sort by match score descending within current page
    usersWithMatch.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      users: usersWithMatch,
      totalPages,
      currentPage: page,
      totalUsers,
      hasNextPage: page < totalPages
    });
  } catch (error) {
    console.error('getAllUsers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── PUT /api/users/profile ───────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { name, bio, skillsOffered, skillsWanted } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { name, bio, skillsOffered, skillsWanted },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Keep session in sync if it exists
    if (req.session) req.session.userName = updatedUser.name;

    res.json({ success: true, message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/users/matches ───────────────────────────────────────────────────
// Returns only users with a non-zero match score (all users, no pagination)
const getMatches = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).lean();
    const allUsers = await User.find({ _id: { $ne: req.userId } }).select('-password').lean();

    const matches = allUsers.map(user => {
      const myOffered = currentUser.skillsOffered.map(s => s.toLowerCase());
      const myWanted = currentUser.skillsWanted.map(s => s.toLowerCase());
      const theirOffered = user.skillsOffered.map(s => s.toLowerCase());
      const theirWanted = user.skillsWanted.map(s => s.toLowerCase());

      const theyOfferWhatIWant = myWanted.filter(s => theirOffered.includes(s));
      const theyWantWhatIOffer = myOffered.filter(s => theirWanted.includes(s));

      const totalPossible = Math.max(myWanted.length + myOffered.length, 1);
      const matchScore = Math.min(100, Math.round(
        ((theyOfferWhatIWant.length + theyWantWhatIOffer.length) / totalPossible) * 100
      ));

      return {
        ...user,
        matchScore,
        matchedSkillsOffered: theyOfferWhatIWant,
        matchedSkillsWanted: theyWantWhatIOffer
      };
    }).filter(u => u.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore);

    res.json({ success: true, matches });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAllUsers, getUserById, updateProfile, getMatches };
