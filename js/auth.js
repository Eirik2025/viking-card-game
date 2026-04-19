import { supabase } from './supabase-client.js';

// Check if already logged in
supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) window.location.href = 'index.html';
});

// Tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const form = tab.dataset.tab;
        document.getElementById('login-form').classList.toggle('hidden', form !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', form !== 'register');
        document.getElementById('auth-error').textContent = '';
    });
});

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
    });
    
    if (error) {
        showError(error.message);
    } else {
        window.location.href = 'index.html';
    }
});

// Register
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    
    if (password !== confirm) {
        showError('Passwords do not match');
        return;
    }
    
    const email = document.getElementById('reg-email').value;
    const username = document.getElementById('reg-username').value;
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username }
        }
    });
    
    if (error) {
        showError(error.message);
    } else {
        // Create profile
        await supabase.from('profiles').insert({
            id: data.user.id,
            username,
            level: 1,
            experience: 0,
            prestige_level: 0,
            total_wins: 0,
            gold: 1000
        });
        
        window.location.href = 'index.html';
    }
});

function showError(msg) {
    const err = document.getElementById('auth-error');
    err.textContent = msg;
    err.classList.add('show');
    setTimeout(() => err.classList.remove('show'), 500);
}