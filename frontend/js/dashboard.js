const API_BASE = 'https://adpay-rho.vercel.app/';

// Global variables
let currentAd = null;
let adTimer = null;
let timeLeft = 0;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadUserData();
    loadTransactions();
    loadReferralStats();
    setupEventListeners();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = '/';
        return;
    }

    // Display user name
    const userData = JSON.parse(user);
    document.getElementById('userName').textContent = userData.fullName;
}

function setupEventListeners() {
    // Bank form submission
    document.getElementById('bankForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveBankDetails();
    });

    // Withdrawal form submission
    document.getElementById('withdrawalForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await requestWithdrawal();
    });
}

async function loadUserData() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            const user = result.data.user;
            updateDashboard(user);
            // Update localStorage with latest user data
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            alert('Failed to load user data');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

function updateDashboard(user) {
    document.getElementById('currentBalance').textContent = `₦${user.balance.toLocaleString()}`;
    document.getElementById('totalEarned').textContent = `₦${user.totalEarned.toLocaleString()}`;
    document.getElementById('adsWatchedToday').textContent = `${user.adsWatchedToday}/${user.adLimit}`;
    document.getElementById('adLimit').textContent = user.adLimit;
    document.getElementById('referralCodeDisplay').textContent = user.referralCode;

    // Set minimum withdrawal amount based on user type
    const minWithdrawal = user.userType === 'premium' ? 10000 : 5000;
    document.getElementById('minWithdrawal').textContent = `₦${minWithdrawal.toLocaleString()}`;

    // Calculate next payment date
    const nextPayment = calculateNextPaymentDate();
    document.getElementById('nextPaymentDate').textContent = nextPayment.toDateString();

    // Update bank form if user has bank details
    if (user.bankAccount) {
        document.getElementById('bankName').value = user.bankAccount.bankName || '';
        document.getElementById('accountNumber').value = user.bankAccount.accountNumber || '';
        document.getElementById('accountName').value = user.bankAccount.accountName || '';
    }
}

function calculateNextPaymentDate() {
    const today = new Date();
    const day = today.getDate();
    let nextDate;

    if (day < 5) {
        nextDate = new Date(today.getFullYear(), today.getMonth(), 5);
    } else if (day < 17) {
        nextDate = new Date(today.getFullYear(), today.getMonth(), 17);
    } else {
        nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 5);
    }

    return nextDate;
}

async function loadTransactions() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/users/transactions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            displayTransactions(result.data.transactions);
        } else {
            console.error('Failed to load transactions');
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function displayTransactions(transactions) {
    const tbody = document.querySelector('#transactionsTable tbody');
    tbody.innerHTML = '';

    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        const date = new Date(transaction.createdAt).toLocaleDateString();
        const amount = `₦${transaction.amount.toLocaleString()}`;
        const statusClass = `status-${transaction.status}`;
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${transaction.description}</td>
            <td>${amount}</td>
            <td><span class="status-badge ${statusClass}">${transaction.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

async function loadReferralStats() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/users/referrals`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            displayReferralStats(result.data);
        } else {
            console.error('Failed to load referral stats');
        }
    } catch (error) {
        console.error('Error loading referral stats:', error);
    }
}

function displayReferralStats(data) {
    const statsDiv = document.getElementById('referralStats');
    statsDiv.innerHTML = `
        <div class="stats-cards">
            <div class="stat-card">
                <h3>Total Referrals</h3>
                <div class="amount">${data.totalReferrals}</div>
            </div>
            <div class="stat-card">
                <h3>Active Referrals</h3>
                <div class="amount">${data.activeReferrals}</div>
            </div>
            <div class="stat-card">
                <h3>Total Bonus</h3>
                <div class="amount">₦${data.actualBonus.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <h3>Potential Bonus</h3>
                <div class="amount">₦${data.potentialBonus.toLocaleString()}</div>
            </div>
        </div>
        ${data.referrals.length > 0 ? `
            <h4>Recent Referrals:</h4>
            <ul>
                ${data.referrals.slice(0, 5).map(ref => `
                    <li>${ref.fullName} (${ref.email}) - ${ref.userType} - ${ref.isActive ? 'Active' : 'Pending'}</li>
                `).join('')}
            </ul>
        ` : '<p>No referrals yet.</p>'}
    `;
}

async function saveBankDetails() {
    const bankName = document.getElementById('bankName').value;
    const accountNumber = document.getElementById('accountNumber').value;
    const accountName = document.getElementById('accountName').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/users/bank-details`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ bankName, accountNumber, accountName })
        });

        const result = await response.json();

        if (result.success) {
            alert('Bank details saved successfully!');
            loadUserData(); // Reload user data
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error saving bank details:', error);
        alert('Failed to save bank details');
    }
}

async function requestWithdrawal() {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const user = JSON.parse(localStorage.getItem('user'));
    const minWithdrawal = user.userType === 'premium' ? 10000 : 5000;

    if (amount < minWithdrawal) {
        alert(`Minimum withdrawal amount is ₦${minWithdrawal.toLocaleString()}`);
        return;
    }

    if (amount > user.balance) {
        alert('Insufficient balance');
        return;
    }

    if (!confirm(`Are you sure you want to withdraw ₦${amount.toLocaleString()}?`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/withdrawals/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount })
        });

        const result = await response.json();

        if (result.success) {
            alert('Withdrawal request submitted successfully!');
            document.getElementById('withdrawAmount').value = '';
            loadUserData(); // Reload user data to update balance
            loadTransactions(); // Reload transactions
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error requesting withdrawal:', error);
        alert('Failed to request withdrawal');
    }
}

function copyReferralCode() {
    const referralCode = document.getElementById('referralCodeDisplay').textContent;
    navigator.clipboard.writeText(referralCode).then(() => {
        alert('Referral code copied to clipboard!');
    });
}

// Ad watching functionality
async function loadAd() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/ads/load`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            currentAd = result.data.ad;
            displayAd(currentAd);
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error loading ad:', error);
        alert('Failed to load ad');
    }
}

function displayAd(ad) {
    const adPlaceholder = document.getElementById('adPlaceholder');
    const loadAdBtn = document.getElementById('loadAdBtn');
    const watchAdBtn = document.getElementById('watchAdBtn');
    const adResult = document.getElementById('adResult');

    adResult.style.display = 'none';
    adPlaceholder.innerHTML = `
        <h3>${ad.title}</h3>
        <p>${ad.description}</p>
        <div class="ad-content">
            <img src="${ad.imageUrl}" 
                 alt="${ad.title}" style="max-width: 100%; border-radius: 5px;">
        </div>
        <p>Watch for 30 seconds to earn ₦${ad.earnings}</p>
    `;
    loadAdBtn.style.display = 'none';
    watchAdBtn.style.display = 'inline-block';
    watchAdBtn.disabled = false;
    watchAdBtn.textContent = 'Watch Ad (30s)';
}

function watchAd() {
    const watchAdBtn = document.getElementById('watchAdBtn');
    const adPlaceholder = document.getElementById('adPlaceholder');
    
    watchAdBtn.disabled = true;

    // Add timer display
    adPlaceholder.innerHTML += `
        <div class="timer-display">30s</div>
        <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
        </div>
    `;

    const timerDisplay = adPlaceholder.querySelector('.timer-display');
    const progressFill = document.getElementById('progressFill');

    timeLeft = 30;
    
    adTimer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `${timeLeft}s`;
        progressFill.style.width = `${((30 - timeLeft) / 30) * 100}%`;

        if (timeLeft <= 0) {
            clearInterval(adTimer);
            completeAd();
        }
    }, 1000);
}

async function completeAd() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/ads/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ adId: currentAd.id })
        });

        const result = await response.json();

        if (result.success) {
            showAdResult(result.data.earnings);
            loadUserData(); // Update balance and ads watched
        } else {
            alert(result.message);
            resetAdInterface();
        }
    } catch (error) {
        console.error('Error completing ad:', error);
        alert('Failed to complete ad');
        resetAdInterface();
    }
}

function showAdResult(earnings) {
    const adResult = document.getElementById('adResult');
    const earnedAmount = document.getElementById('earnedAmount');
    const watchAdBtn = document.getElementById('watchAdBtn');
    const loadAdBtn = document.getElementById('loadAdBtn');

    earnedAmount.textContent = `₦${earnings}`;
    adResult.style.display = 'block';
    watchAdBtn.style.display = 'none';
    loadAdBtn.style.display = 'inline-block';
}

function resetAdInterface() {
    const watchAdBtn = document.getElementById('watchAdBtn');
    const loadAdBtn = document.getElementById('loadAdBtn');
    
    watchAdBtn.style.display = 'none';
    watchAdBtn.disabled = false;
    watchAdBtn.textContent = 'Watch Ad (30s)';
    loadAdBtn.style.display = 'inline-block';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';

}
