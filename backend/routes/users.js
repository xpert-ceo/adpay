import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const router = express.Router();

// Update bank details
router.put('/bank-details', authenticate, async (req, res) => {
  try {
    const { bankName, accountNumber, accountName } = req.body;

    // Basic validation
    if (!bankName || !accountNumber || !accountName) {
      return res.status(400).json({
        success: false,
        message: 'All bank details are required.'
      });
    }

    if (accountNumber.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account number.'
      });
    }

    const user = await User.findById(req.user._id);
    user.bankAccount = {
      bankName,
      accountNumber,
      accountName
    };

    await user.save();

    res.json({
      success: true,
      message: 'Bank details updated successfully.',
      data: {
        bankAccount: user.bankAccount
      }
    });

  } catch (error) {
    console.error('Bank details update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bank details.'
    });
  }
});

// Get user transactions
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: {
        transactions
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions.'
    });
  }
});

// Get referral stats
router.get('/referrals', authenticate, async (req, res) => {
  try {
    const referrals = await User.find({ referredBy: req.user._id })
      .select('fullName email userType registrationDate isActive');

    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(ref => ref.isActive).length;
    const basicReferrals = referrals.filter(ref => ref.userType === 'basic').length;
    const premiumReferrals = referrals.filter(ref => ref.userType === 'premium').length;
    
    // Calculate bonuses
    const potentialBonus = (basicReferrals * 500) + (premiumReferrals * 1000);
    const actualBonus = referrals.filter(ref => ref.isActive).reduce((total, ref) => {
      return total + (ref.userType === 'premium' ? 1000 : 500);
    }, 0);

    res.json({
      success: true,
      data: {
        totalReferrals,
        activeReferrals,
        basicReferrals,
        premiumReferrals,
        potentialBonus,
        actualBonus,
        referrals
      }
    });

  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral data.'
    });
  }
});

export default router;