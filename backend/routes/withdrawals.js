import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const router = express.Router();

// Request withdrawal
router.post('/request', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { amount } = req.body;

    // Check if user has bank details
    if (!user.bankAccount || !user.bankAccount.accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please add your bank details before requesting withdrawal.'
      });
    }

    // Check minimum withdrawal amount based on user type
    const minWithdrawal = user.userType === 'premium' ? 10000 : 5000;
    if (amount < minWithdrawal) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ₦${minWithdrawal.toLocaleString()}.`
      });
    }

    // Check if user has sufficient balance
    if (user.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance.'
      });
    }

    // Check if it's a valid payment date
    const today = new Date();
    const day = today.getDate();
    const hour = today.getHours();
    
    let validPaymentDate = false;
    
    if (user.userType === 'basic') {
      // Basic users: 5th & 17th, 5 AM - 8 AM
      if ((day === 5 || day === 17) && hour >= 5 && hour < 8) {
        validPaymentDate = true;
      }
    } else {
      // Premium users: 5th & 17th, 5 AM - 12 PM
      if ((day === 5 || day === 17) && hour >= 5 && hour < 12) {
        validPaymentDate = true;
      }
    }

    if (!validPaymentDate) {
      return res.status(400).json({
        success: false,
        message: 'Withdrawals are only processed on payment days (5th & 17th).'
      });
    }

    // Deduct balance and create withdrawal transaction
    user.balance -= amount;
    await user.save();

    const withdrawal = await Transaction.create({
      user: user._id,
      type: 'withdrawal',
      amount: amount,
      description: `Withdrawal request to ${user.bankAccount.bankName} (${user.bankAccount.accountNumber})`,
      status: 'pending',
      reference: `WD-${Date.now()}-${user._id}`,
      metadata: {
        bankDetails: user.bankAccount
      }
    });

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully. It will be processed shortly.',
      data: {
        withdrawalId: withdrawal._id
      }
    });

  } catch (error) {
    console.error('Withdrawal request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request withdrawal.'
    });
  }
});

// Get user's withdrawal history
router.get('/history', authenticate, async (req, res) => {
  try {
    const withdrawals = await Transaction.find({
      user: req.user._id,
      type: 'withdrawal'
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { withdrawals }
    });

  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawal history.'
    });
  }
});

export default router;