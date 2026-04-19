import { supabase, getCurrentUser, signOut } from './supabase-client.js';

// Expose to window for HTML inline handlers
window.signOut = signOut;

async function loadUserData() {
    const user = await getCurrentUser();
    if (user) {
        document.getElementById('username').textContent = user.email;
        document.getElementById('welcome-name').textContent = user.user_metadata.username || 'Warrior';
    }
}

async function loadLeaderboard(period = '24h') {
    const { data, error } = await supabase
        .from('leaderboards')
        .select('username, wins, rank')
        .eq('period', period)
        .order('rank', { ascending: true })
        .limit(10);
    
    const container = document.getElementById('leaderboard-content');
    if (error || !data) {
        container.innerHTML = '<div class="loading">No data available</div>';
        return;
    }
    
    container.innerHTML = data.map((entry, index) => `
        <div class="leaderboard-item">
            <span class="rank-${index + 1}">#${entry.rank} ${entry.username}</span>
            <span>${entry.wins} wins</span>
        </div>
    `).join('');
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        loadLeaderboard(e.target.dataset.period);
    });
});

loadUserData();
loadLeaderboard();