import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  userType: {
    type: String,
    enum: ['basic', 'premium'],
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  usedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000 // 30 days
  }
});

export default mongoose.model('Token', tokenSchema);