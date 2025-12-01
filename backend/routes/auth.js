import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Token from '../models/Token.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, password, referralCode, userType, tokenCode } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone already exists.'
      });
    }

    // Validate registration token
    const registrationToken = await Token.findOne({ 
      code: tokenCode.toUpperCase(),
      isUsed: false 
    });

    if (!registrationToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or already used registration token.'
      });
    }

    if (registrationToken.userType !== userType) {
      return res.status(400).json({
        success: false,
        message: `Token is for ${registrationToken.userType} users only.`
      });
    }

    // Check referral code if provided
    let referredBy = null;
    if (referralCode) {
      referredBy = await User.findOne({ referralCode });
      if (!referredBy) {
        return res.status(400).json({
          success: false,
          message: 'Invalid referral code.'
        });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate unique referral code
    let userReferralCode;
    let isUnique = false;
    
    while (!isUnique) {
      userReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existingCode = await User.findOne({ referralCode: userReferralCode });
      if (!existingCode) isUnique = true;
    }

    // Create user (inactive by default)
    const user = new User({
      fullName,
      email,
      phone,
      password: hashedPassword,
      userType,
      referralCode: userReferralCode,
      referredBy,
      balance: 0,
      adsWatchedToday: 0,
      lastAdDate: new Date(),
      isActive: false
    });

    await user.save();

    // Mark token as used
    registrationToken.isUsed = true;
    registrationToken.usedBy = user._id;
    registrationToken.usedAt = new Date();
    await registrationToken.save();

    // Generate JWT token
    const authToken = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please contact admin for activation.',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          userType: user.userType,
          referralCode: user.referralCode,
          isActive: user.isActive
        },
        token: authToken,
        paymentInstructions: `Please pay ₦${registrationToken.price} to admin and share your user ID: ${user._id}`
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Account not active. Please contact admin after making payment.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          userType: user.userType,
          balance: user.balance,
          referralCode: user.referralCode,
          adsWatchedToday: user.adsWatchedToday,
          adLimit: user.userType === 'basic' ? 50 : 'Unlimited'
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email,
          userType: req.user.userType,
          balance: req.user.balance,
          referralCode: req.user.referralCode,
          adsWatchedToday: req.user.adsWatchedToday,
          adLimit: req.user.userType === 'basic' ? 50 : 'Unlimited',
          totalEarned: req.user.totalEarned,
          bankAccount: req.user.bankAccount
        }
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user data.'
    });
  }
});

export default router;