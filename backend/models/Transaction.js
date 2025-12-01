import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['ad_view', 'referral_bonus', 'withdrawal', 'registration'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  reference: {
    type: String,
    unique: true,
  },
  metadata: {
    adId: String,
    referredUser: mongoose.Schema.Types.ObjectId,
    bankDetails: Object,
  }
}, {
  timestamps: true,
});

export default mongoose.model('Transaction', transactionSchema);