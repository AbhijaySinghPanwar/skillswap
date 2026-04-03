const User = require('../models/User');
const Request = require('../models/Request');

// GET /api/users - Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.session.userId } }).select('-password');
    
    // Compute match percentage for each user
    const currentUser = await User.findById(req.session.userId);
    
    const usersWithMatch = users.map(user => {
      const userObj = user.toObject();
      
      if (currentUser) {
        const myOffered = currentUser.skillsOffered.map(s => s.toLowerCase());
        const myWanted = currentUser.skillsWanted.map(s => s.toLowerCase());
        const theirOffered = user.skillsOffered.map(s => s.toLowerCase());
        const theirWanted = user.skillsWanted.map(s => s.toLowerCase());

        // They offer what I want + they want what I offer
        const theyOfferWhatIWant = myWanted.filter(s => theirOffered.includes(s)).length;
        const theyWantWhatIOffer = myOffered.filter(s => theirWanted.includes(s)).length;

        const totalPossible = Math.max(myWanted.length + myOffered.length, 1);
        const matchScore = Math.min(100, Math.round(((theyOfferWhatIWant + theyWantWhatIOffer) / totalPossible) * 100));

        userObj.matchScore = matchScore;
      } else {
        userObj.matchScore = 0;
      }

      return userObj;
    });

    // Sort by match score descending
    usersWithMatch.sort((a, b) => b.matchScore - a.matchScore);

    res.json({ success: true, users: usersWithMatch });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/users/:id - Get single user
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

// PUT /api/users/profile - Update profile
const updateProfile = async (req, res) => {
  try {
    const { name, bio, skillsOffered, skillsWanted } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.session.userId,
      { name, bio, skillsOffered, skillsWanted },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    req.session.userName = updatedUser.name;

    res.json({ success: true, message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/users/matches - Get best matches for current user
const getMatches = async (req, res) => {
  try {
    const currentUser = await User.findById(req.session.userId);
    const allUsers = await User.find({ _id: { $ne: req.session.userId } }).select('-password');

    const matches = allUsers.map(user => {
      const userObj = user.toObject();
      const myOffered = currentUser.skillsOffered.map(s => s.toLowerCase());
      const myWanted = currentUser.skillsWanted.map(s => s.toLowerCase());
      const theirOffered = user.skillsOffered.map(s => s.toLowerCase());
      const theirWanted = user.skillsWanted.map(s => s.toLowerCase());

      const theyOfferWhatIWant = myWanted.filter(s => theirOffered.includes(s));
      const theyWantWhatIOffer = myOffered.filter(s => theirWanted.includes(s));

      const totalPossible = Math.max(myWanted.length + myOffered.length, 1);
      const matchScore = Math.min(100, Math.round(((theyOfferWhatIWant.length + theyWantWhatIOffer.length) / totalPossible) * 100));

      userObj.matchScore = matchScore;
      userObj.matchedSkillsOffered = theyOfferWhatIWant;
      userObj.matchedSkillsWanted = theyWantWhatIOffer;

      return userObj;
    }).filter(u => u.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore);

    res.json({ success: true, matches });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAllUsers, getUserById, updateProfile, getMatches };
