import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/adpay', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

console.log('🔧 Setting up AdPay database...');

// This is just a setup helper - we'll create admin functionality in the admin panel
console.log('✅ Database setup complete!');
console.log('🚀 Run "npm run dev" to start the server');