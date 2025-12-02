// API Base URL
const API_BASE = 'https://adpay-rho.vercel.app/api';

// Mobile Menu Management
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    mobileMenu.classList.toggle('active');
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(event) {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    
    if (mobileMenu.classList.contains('active') && 
        !mobileMenu.contains(event.target) && 
        !mobileMenuBtn.contains(event.target)) {
        mobileMenu.classList.remove('active');
    }
});

// Modal Management
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
    // Close mobile menu if open
    document.getElementById('mobileMenu').classList.remove('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modals = document.getElementsByClassName('modal');
    for (let modal of modals) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
}

// Plan Selection
function selectPlan(planType) {
    document.getElementById('planSelect').value = planType;
    openModal('registerModal');
}

// Form Handling
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    await handleLogin();
});

document.getElementById('registerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    await handleRegister();
});

// API Functions
async function handleLogin() {
    const formData = new FormData(document.getElementById('loginForm'));
    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('token', result.data.token);
            localStorage.setItem('user', JSON.stringify(result.data.user));
            alert('Login successful!');
            closeModal('loginModal');
            // Redirect to dashboard
            window.location.href = '/dashboard.html';
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

async function handleRegister() {
    const formData = new FormData(document.getElementById('registerForm'));
    const data = {
        fullName: formData.get('fullName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        password: formData.get('password'),
        referralCode: formData.get('referralCode') || undefined,
        userType: formData.get('userType'),
        tokenCode: formData.get('tokenCode')
    };

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('token', result.data.token);
            localStorage.setItem('user', JSON.stringify(result.data.user));
            alert(result.data.paymentInstructions);
            closeModal('registerModal');
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed. Please try again.');
    }
}

// Check if user is logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        // User is logged in, show dashboard link
        const navLinks = document.querySelector('.nav-links');
        const mobileMenu = document.querySelector('.mobile-menu');
        
        if (navLinks) {
            const existingDashboard = navLinks.querySelector('a[href="/dashboard.html"]');
            if (!existingDashboard) {
                navLinks.innerHTML += `
                    <a href="/dashboard.html">Dashboard</a>
                    <button class="btn-logout" onclick="logout()">Logout</button>
                `;
            }
        }
        
        if (mobileMenu) {
            const existingDashboard = mobileMenu.querySelector('a[href="/dashboard.html"]');
            if (!existingDashboard) {
                mobileMenu.innerHTML += `
                    <a href="/dashboard.html" onclick="toggleMobileMenu()">Dashboard</a>
                    <button class="btn-logout" onclick="logout(); toggleMobileMenu();">Logout</button>
                `;
            }
        }
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Initialize auth check when page loads
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();

});

