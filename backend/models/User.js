import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  fullName: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  userType: {
    type: String,
    enum: ['basic', 'premium'],
    default: 'basic',
  },
  referralCode: {
    type: String,
    unique: true,
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  balance: {
    type: Number,
    default: 0,
  },
  totalEarned: {
    type: Number,
    default: 0,
  },
  adsWatchedToday: {
    type: Number,
    default: 0,
  },
  lastAdDate: {
    type: Date,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  registrationDate: {
    type: Date,
    default: Date.now,
  },
  bankAccount: {
    bankName: String,
    accountNumber: String,
    accountName: String,
  }
}, {
  timestamps: true,
});

// Reset ads watched daily
userSchema.methods.resetDailyAds = function() {
  const today = new Date().toDateString();
  const lastAdDay = this.lastAdDate ? this.lastAdDate.toDateString() : null;
  
  if (lastAdDay !== today) {
    this.adsWatchedToday = 0;
    this.lastAdDate = new Date();
  }
};

export default mongoose.model('User', userSchema);