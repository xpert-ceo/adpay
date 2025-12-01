import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const router = express.Router();

// Sample ads database
const sampleAds = [
  {
    id: 'ad_001',
    title: 'Amazing Product Launch',
    description: 'Discover our revolutionary new product that will change your life!',
    imageUrl: 'https://via.placeholder.com/300x200/333/FFD700?text=Product+Ad',
    duration: 30,
    category: 'Technology'
  },
  {
    id: 'ad_002',
    title: 'Summer Sale - 50% Off',
    description: 'Don\'t miss our biggest sale of the year! Limited time offer.',
    imageUrl: 'https://via.placeholder.com/300x200/333/FFD700?text=Summer+Sale',
    duration: 30,
    category: 'Shopping'
  },
  {
    id: 'ad_003',
    title: 'New Mobile App',
    description: 'Download our new app and get exclusive rewards and features.',
    imageUrl: 'https://via.placeholder.com/300x200/333/FFD700?text=Mobile+App',
    duration: 30,
    category: 'Technology'
  },
  {
    id: 'ad_004',
    title: 'Travel Destination',
    description: 'Explore beautiful destinations around the world with special deals.',
    imageUrl: 'https://via.placeholder.com/300x200/333/FFD700?text=Travel+Ad',
    duration: 30,
    category: 'Travel'
  },
  {
    id: 'ad_005',
    title: 'Fitness Program',
    description: 'Transform your body with our 30-day fitness challenge.',
    imageUrl: 'https://via.placeholder.com/300x200/333/FFD700?text=Fitness+Ad',
    duration: 30,
    category: 'Health'
  }
];

// Load an ad for the user
router.get('/load', authenticate, async (req, res) => {
  try {
    const user = req.user;

    // Reset daily ads if needed
    user.resetDailyAds();
    await user.save();

    // Check if user has reached daily ad limit
    if (user.userType === 'basic' && user.adsWatchedToday >= 50) {
      return res.status(400).json({
        success: false,
        message: 'Daily ad limit reached. Upgrade to premium for unlimited ads.'
      });
    }

    // Get a random ad
    const randomAd = sampleAds[Math.floor(Math.random() * sampleAds.length)];
    
    // Add earnings information based on user type
    const adWithEarnings = {
      ...randomAd,
      earnings: user.userType === 'premium' ? 20 : 15
    };

    res.json({
      success: true,
      data: { ad: adWithEarnings }
    });

  } catch (error) {
    console.error('Load ad error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load ad.'
    });
  }
});

// Complete an ad and credit earnings
router.post('/complete', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { adId } = req.body;

    // Reset daily ads if needed
    user.resetDailyAds();

    // Check daily ad limit for basic users
    if (user.userType === 'basic' && user.adsWatchedToday >= 50) {
      return res.status(400).json({
        success: false,
        message: 'Daily ad limit reached. Upgrade to premium for unlimited ads.'
      });
    }

    // Calculate earnings based on user type
    const earnings = user.userType === 'premium' ? 20 : 15;

    // Update user balance and ad count
    user.balance += earnings;
    user.totalEarned += earnings;
    user.adsWatchedToday += 1;
    user.lastAdDate = new Date();
    await user.save();

    // Create transaction record
    await Transaction.create({
      user: user._id,
      type: 'ad_view',
      amount: earnings,
      description: `Earnings from watching ad`,
      status: 'completed',
      reference: `AD-${Date.now()}-${user._id}`,
      metadata: {
        adId: adId
      }
    });

    res.json({
      success: true,
      message: 'Ad completed successfully.',
      data: {
        earnings
      }
    });

  } catch (error) {
    console.error('Complete ad error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete ad.'
    });
  }
});

export default router;