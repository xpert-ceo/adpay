import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// ====================
// MIDDLEWARE
// ====================
app.use(helmet());
app.use(cors({
    origin: '*', // Allow all for now
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====================
// MONGODB CONNECTION
// ====================
let isDBConnected = false;

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.log('⚠️ MONGODB_URI not set, using in-memory database');
            return;
        }
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        isDBConnected = true;
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.log('⚠️ Using in-memory database for now');
    }
};

connectDB();

// ====================
// IN-MEMORY DATABASE (Fallback)
// ====================
let users = [];
let tokens = [];
let transactions = [];

// ====================
// HELPER FUNCTIONS
// ====================
const generateReferralCode = () => {
    return 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

const generateTokenCode = () => {
    return 'ADP' + Math.random().toString(36).substring(2, 10).toUpperCase();
};

// ====================
// API ENDPOINTS
// ====================

// 1. HEALTH CHECK (Always works)
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'AdPay API v3.0 is LIVE!',
        timestamp: new Date().toISOString(),
        database: isDBConnected ? 'MongoDB' : 'In-Memory',
        environment: process.env.NODE_ENV || 'development'
    });
});

// 2. REGISTRATION ENDPOINT
app.post('/api/auth/register', async (req, res) => {
    try {
        console.log('📝 Registration request:', req.body);
        
        const { fullName, email, phone, password, referralCode, userType, tokenCode } = req.body;

        // Validate required fields
        if (!fullName || !email || !phone || !password || !userType || !tokenCode) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Check if email already exists
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Validate token (simplified for now)
        if (!tokenCode || tokenCode.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Invalid registration token'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const userId = 'user_' + Date.now();
        const userReferralCode = generateReferralCode();
        
        const newUser = {
            _id: userId,
            fullName,
            email: email.toLowerCase(),
            phone,
            password: hashedPassword,
            userType,
            referralCode: userReferralCode,
            referredBy: referralCode || null,
            balance: 0,
            totalEarned: 0,
            adsWatchedToday: 0,
            lastAdDate: null,
            isActive: false,
            registrationDate: new Date(),
            bankAccount: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        users.push(newUser);

        // Create transaction record
        const transaction = {
            _id: 'txn_' + Date.now(),
            user: userId,
            type: 'registration',
            amount: userType === 'premium' ? 5000 : 3000,
            description: `${userType} registration`,
            status: 'pending',
            reference: `REG-${Date.now()}`,
            metadata: { tokenCode },
            createdAt: new Date()
        };
        transactions.push(transaction);

        console.log('✅ User registered:', email);

        // Return success
        res.status(201).json({
            success: true,
            message: 'Registration successful!',
            data: {
                user: {
                    id: userId,
                    fullName,
                    email,
                    userType,
                    referralCode: userReferralCode,
                    isActive: false
                },
                token: jwt.sign({ userId }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' }),
                paymentInstructions: `Please pay ₦${userType === 'premium' ? '5,000' : '3,000'} to admin.\nUser ID: ${userId}\nEmail: ${email}`
            }
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 3. LOGIN ENDPOINT
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = users.find(u => u.email === email.toLowerCase());
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if active
        if (!user.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Account not active. Please contact admin after payment.'
            });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
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
            message: 'Login failed'
        });
    }
});

// 4. GET CURRENT USER
app.get('/api/auth/me', (req, res) => {
    try {
        // Simple demo user
        const demoUser = {
            _id: 'demo_user',
            fullName: 'Demo User',
            email: 'demo@adpay.com',
            userType: 'premium',
            balance: 15000,
            referralCode: 'DEMO123',
            adsWatchedToday: 5,
            totalEarned: 25000,
            bankAccount: {
                bankName: 'GTBank',
                accountNumber: '0123456789',
                accountName: 'Demo User'
            }
        };

        res.json({
            success: true,
            data: {
                user: {
                    id: demoUser._id,
                    fullName: demoUser.fullName,
                    email: demoUser.email,
                    userType: demoUser.userType,
                    balance: demoUser.balance,
                    referralCode: demoUser.referralCode,
                    adsWatchedToday: demoUser.adsWatchedToday,
                    adLimit: demoUser.userType === 'basic' ? 50 : 'Unlimited',
                    totalEarned: demoUser.totalEarned,
                    bankAccount: demoUser.bankAccount
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch user' });
    }
});

// ====================
// ADMIN ENDPOINTS
// ====================

// 5. ADMIN LOGIN
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@adpay.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        res.json({
            success: true,
            message: 'Admin login successful',
            data: {
                admin: { email: ADMIN_EMAIL },
                token: 'admin_token_' + Date.now()
            }
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid admin credentials'
        });
    }
});

// 6. GENERATE TOKENS
app.post('/api/admin/tokens/generate', (req, res) => {
    try {
        const { userType = 'basic', quantity = 1 } = req.body;
        
        if (!['basic', 'premium'].includes(userType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user type'
            });
        }
        
        const generatedTokens = [];
        const price = userType === 'premium' ? 5000 : 3000;
        
        for (let i = 0; i < quantity; i++) {
            const token = {
                code: generateTokenCode(),
                userType,
                price,
                isUsed: false,
                usedBy: null,
                usedAt: null,
                createdAt: new Date()
            };
            tokens.push(token);
            generatedTokens.push(token);
        }
        
        res.json({
            success: true,
            message: `${quantity} ${userType} token(s) generated`,
            data: { tokens: generatedTokens }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate tokens'
        });
    }
});

// 7. GET ALL TOKENS
app.get('/api/admin/tokens', (req, res) => {
    res.json({
        success: true,
        data: {
            tokens: tokens.slice(0, 50), // Last 50 tokens
            total: tokens.length
        }
    });
});

// 8. GET PENDING USERS
app.get('/api/admin/users/pending', (req, res) => {
    const pendingUsers = users.filter(user => !user.isActive);
    
    res.json({
        success: true,
        data: {
            users: pendingUsers.map(user => ({
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                userType: user.userType,
                registrationDate: user.registrationDate,
                referredBy: user.referredBy
            }))
        }
    });
});

// 9. ACTIVATE USER
app.put('/api/admin/users/:userId/activate', (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = users.find(u => u._id === userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        if (user.isActive) {
            return res.status(400).json({
                success: false,
                message: 'User already active'
            });
        }
        
        // Activate user
        user.isActive = true;
        user.updatedAt = new Date();
        
        // Update transaction status
        const txn = transactions.find(t => t.user === userId && t.type === 'registration');
        if (txn) {
            txn.status = 'completed';
        }
        
        // Process referral bonus if applicable
        if (user.referredBy) {
            const referrer = users.find(u => u.referralCode === user.referredBy);
            if (referrer) {
                const bonusAmount = user.userType === 'premium' ? 1000 : 500;
                referrer.balance += bonusAmount;
                
                transactions.push({
                    _id: 'ref_' + Date.now(),
                    user: referrer._id,
                    type: 'referral_bonus',
                    amount: bonusAmount,
                    description: `Referral bonus for ${user.userType} user ${user.fullName}`,
                    status: 'completed',
                    reference: `REF-${Date.now()}`,
                    createdAt: new Date()
                });
            }
        }
        
        res.json({
            success: true,
            message: 'User activated successfully',
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
        res.status(500).json({
            success: false,
            message: 'Failed to activate user'
        });
    }
});

// 10. GET ALL USERS
app.get('/api/admin/users', (req, res) => {
    res.json({
        success: true,
        data: {
            users: users.map(user => ({
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                userType: user.userType,
                balance: user.balance,
                isActive: user.isActive,
                registrationDate: user.registrationDate,
                adsWatchedToday: user.adsWatchedToday
            })),
            total: users.length
        }
    });
});

// 11. DASHBOARD STATS
app.get('/api/admin/dashboard', (req, res) => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive).length;
    const pendingUsers = users.filter(u => !u.isActive).length;
    const basicUsers = users.filter(u => u.userType === 'basic' && u.isActive).length;
    const premiumUsers = users.filter(u => u.userType === 'premium' && u.isActive).length;
    
    const totalRevenue = transactions
        .filter(t => t.type === 'registration' && t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const recentTransactions = transactions
        .slice(-10)
        .reverse()
        .map(txn => ({
            ...txn,
            user: users.find(u => u._id === txn.user) || { fullName: 'Unknown User' }
        }));
    
    res.json({
        success: true,
        data: {
            stats: {
                totalUsers,
                activeUsers,
                pendingUsers,
                basicUsers,
                premiumUsers,
                totalRevenue
            },
            recentTransactions
        }
    });
});

// ====================
// USER ENDPOINTS
// ====================

// 12. UPDATE BANK DETAILS
app.put('/api/users/bank-details', (req, res) => {
    try {
        const { bankName, accountNumber, accountName } = req.body;
        
        // Simple validation
        if (!bankName || !accountNumber || !accountName) {
            return res.status(400).json({
                success: false,
                message: 'All bank details are required'
            });
        }
        
        // In real app, get user from token
        const demoUser = users[0] || {
            _id: 'demo_user',
            bankAccount: null
        };
        
        demoUser.bankAccount = {
            bankName,
            accountNumber,
            accountName,
            updatedAt: new Date()
        };
        
        res.json({
            success: true,
            message: 'Bank details updated successfully',
            data: {
                bankAccount: demoUser.bankAccount
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update bank details'
        });
    }
});

// 13. GET USER TRANSACTIONS
app.get('/api/users/transactions', (req, res) => {
    const userTransactions = transactions
        .filter(t => t.user === 'demo_user')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 20);
    
    res.json({
        success: true,
        data: { transactions: userTransactions }
    });
});

// 14. GET REFERRAL STATS
app.get('/api/users/referrals', (req, res) => {
    const referrals = users.filter(user => user.referredBy === 'DEMO123');
    
    res.json({
        success: true,
        data: {
            totalReferrals: referrals.length,
            activeReferrals: referrals.filter(r => r.isActive).length,
            basicReferrals: referrals.filter(r => r.userType === 'basic').length,
            premiumReferrals: referrals.filter(r => r.userType === 'premium').length,
            actualBonus: referrals.filter(r => r.isActive).length * 500, // Simplified
            referrals: referrals.slice(0, 10)
        }
    });
});

// ====================
// AD ENDPOINTS
// ====================

// 15. LOAD AD
app.get('/api/ads/load', (req, res) => {
    const ads = [
        {
            id: 'ad_001',
            title: 'Exclusive Shopping Deals',
            description: 'Discover amazing deals on your favorite products',
            imageUrl: 'https://via.placeholder.com/300x200/333/FFD700?text=AdPay+Ad',
            duration: 30,
            earnings: 20
        },
        {
            id: 'ad_002',
            title: 'Financial Services',
            description: 'Smart financial solutions for your future',
            imageUrl: 'https://via.placeholder.com/300x200/333/FFD700?text=AdPay+Ad',
            duration: 30,
            earnings: 15
        }
    ];
    
    const randomAd = ads[Math.floor(Math.random() * ads.length)];
    
    res.json({
        success: true,
        data: {
            ad: {
                ...randomAd,
                sessionId: 'ad_' + Date.now()
            }
        }
    });
});

// 16. COMPLETE AD
app.post('/api/ads/complete', (req, res) => {
    const { sessionId } = req.body;
    
    // In real app, update user balance
    const earnings = 20; // Premium earnings
    
    res.json({
        success: true,
        message: 'Ad completed successfully',
        data: {
            earnings,
            balance: 15200 // Updated balance
        }
    });
});

// ====================
// WITHDRAWAL ENDPOINTS
// ====================

// 17. REQUEST WITHDRAWAL
app.post('/api/withdrawals/request', (req, res) => {
    const { amount } = req.body;
    
    // Simple validation
    if (amount < 5000) {
        return res.status(400).json({
            success: false,
            message: 'Minimum withdrawal is ₦5,000 for Basic, ₦10,000 for Premium'
        });
    }
    
    const withdrawal = {
        _id: 'wd_' + Date.now(),
        user: 'demo_user',
        type: 'withdrawal',
        amount,
        description: `Withdrawal request for ₦${amount}`,
        status: 'pending',
        reference: `WD-${Date.now()}`,
        createdAt: new Date()
    };
    
    transactions.push(withdrawal);
    
    res.json({
        success: true,
        message: 'Withdrawal request submitted',
        data: {
            withdrawalId: withdrawal._id
        }
    });
});

// 18. WITHDRAWAL HISTORY
app.get('/api/withdrawals/history', (req, res) => {
    const userWithdrawals = transactions
        .filter(t => t.type === 'withdrawal' && t.user === 'demo_user')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
        success: true,
        data: { withdrawals: userWithdrawals }
    });
});

// ====================
// ERROR HANDLING
// ====================
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// ====================
// START SERVER
// ====================
const PORT = process.env.PORT || 5000;

// Only start server if not on Vercel
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🗄️  Database: ${isDBConnected ? 'MongoDB' : 'In-Memory'}`);
    });
}

export default app;
