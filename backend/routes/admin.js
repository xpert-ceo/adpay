import express from 'express';
import Token from '../models/Token.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const router = express.Router();

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  const { email, password } = req.body;
  
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid admin credentials.'
    });
  }
};

// Admin login
router.post('/login', adminAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Admin login successful.',
      data: {
        admin: { email: process.env.ADMIN_EMAIL },
        token: 'admin-temporary-token'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin login failed.'
    });
  }
});

// Generate registration tokens
router.post('/tokens/generate', async (req, res) => {
  try {
    const { userType, quantity = 1 } = req.body;

    if (!['basic', 'premium'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type. Must be "basic" or "premium".'
      });
    }

    const price = userType === 'premium' ? 5000 : 3000;
    const tokens = [];

    for (let i = 0; i < quantity; i++) {
      let code;
      let isUnique = false;

      while (!isUnique) {
        code = Math.random().toString(36).substring(2, 10).toUpperCase();
        const existingToken = await Token.findOne({ code });
        if (!existingToken) isUnique = true;
      }

      const token = new Token({
        code,
        userType,
        price
      });

      await token.save();
      tokens.push({
        code: token.code,
        userType: token.userType,
        price: token.price,
        createdAt: token.createdAt
      });
    }

    res.json({
      success: true,
      message: `${quantity} ${userType} token(s) generated successfully.`,
      data: { tokens }
    });

  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate tokens.'
    });
  }
});

// Get all tokens
router.get('/tokens', async (req, res) => {
  try {
    const { page = 1, limit = 20, used } = req.query;
    
    const query = {};
    if (used !== undefined) {
      query.isUsed = used === 'true';
    }

    const tokens = await Token.find(query)
      .populate('usedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Token.countDocuments(query);

    res.json({
      success: true,
      data: { 
        tokens,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });

  } catch (error) {
    console.error('Get tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tokens.'
    });
  }
});

// Get pending users (registered but not activated)
router.get('/users/pending', async (req, res) => {
  try {
    const pendingUsers = await User.find({ isActive: false })
      .select('fullName email phone userType registrationDate referredBy')
      .populate('referredBy', 'fullName email referralCode')
      .sort({ registrationDate: -1 });

    // Get token info for each pending user
    const usersWithTokens = await Promise.all(
      pendingUsers.map(async (user) => {
        const token = await Token.findOne({ usedBy: user._id });
        return {
          ...user.toObject(),
          registrationToken: token ? {
            code: token.code,
            price: token.price,
            usedAt: token.usedAt
          } : null
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithTokens
      }
    });

  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending users.'
    });
  }
});

// Activate user (after manual payment verification)
router.put('/users/:userId/activate', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'User is already active.'
      });
    }

    // Find the token used by this user
    const token = await Token.findOne({ usedBy: user._id });
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'No registration token found for this user.'
      });
    }

    // Activate the user
    user.isActive = true;
    await user.save();

    // Create transaction record for registration fee
    await Transaction.create({
      user: user._id,
      type: 'registration',
      amount: token.price,
      description: `${user.userType} registration fee`,
      status: 'completed',
      reference: `REG-${user._id}-${Date.now()}`,
      metadata: {
        token: token.code
      }
    });

    // Process referral bonus if applicable
    if (user.referredBy) {
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        const referralBonus = user.userType === 'premium' ? 1000 : 500;
        
        referrer.balance += referralBonus;
        await referrer.save();

        // Create transaction for referral bonus
        await Transaction.create({
          user: referrer._id,
          type: 'referral_bonus',
          amount: referralBonus,
          description: `Referral bonus for ${user.userType} user ${user.fullName}`,
          status: 'completed',
          reference: `REF-${Date.now()}`,
          metadata: {
            referredUser: user._id
          }
        });
      }
    }

    res.json({
      success: true,
      message: 'User activated successfully.',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          isActive: user.isActive
        }
      }
    });

  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate user.'
    });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, active, userType } = req.query;
    
    const query = {};
    if (active !== undefined) {
      query.isActive = active === 'true';
    }
    if (userType) {
      query.userType = userType;
    }

    const users = await User.find(query)
      .select('fullName email phone userType balance isActive registrationDate referredBy adsWatchedToday')
      .populate('referredBy', 'fullName email')
      .sort({ registrationDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: { 
        users,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users.'
    });
  }
});

// Get dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const pendingUsers = await User.countDocuments({ isActive: false });
    const basicUsers = await User.countDocuments({ userType: 'basic', isActive: true });
    const premiumUsers = await User.countDocuments({ userType: 'premium', isActive: true });

    const totalRevenue = await Transaction.aggregate([
      { $match: { type: 'registration', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalPayouts = await Transaction.aggregate([
      { $match: { type: 'withdrawal', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalReferralBonuses = await Transaction.aggregate([
      { $match: { type: 'referral_bonus', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Recent transactions
    const recentTransactions = await Transaction.find()
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          pendingUsers,
          basicUsers,
          premiumUsers,
          totalRevenue: totalRevenue[0]?.total || 0,
          totalPayouts: totalPayouts[0]?.total || 0,
          totalReferralBonuses: totalReferralBonuses[0]?.total || 0
        },
        recentTransactions
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats.'
    });
  }
});

export default router;