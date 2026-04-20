import { getCurrentUser } from './supabase-client.js';

async function checkAuth() {
    const user = await getCurrentUser();
    if (!user && !window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
    }
}

checkAuth();