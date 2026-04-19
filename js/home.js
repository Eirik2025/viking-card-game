import { supabase, getCurrentUser, signOut } from './supabase-client.js';

window.signOut = signOut;

async function loadUserData() {
    const user = await getCurrentUser();
    if (!user) return;
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .single();
    
    if (profile) {
        document.getElementById('username').textContent = profile.username || 'Warrior';
        document.getElementById('welcome-name').textContent = profile.username || 'Warrior';
        
        if (profile.avatar_url) {
            const img = document.getElementById('nav-avatar');
            img.src = profile.avatar_url;
            img.classList.remove('hidden');
        }
    }
}

async function loadLeaderboard(period = '24h') {
    const { data } = await supabase
        .from('leaderboards')
        .select('username, wins, rank')
        .eq('period', period)
        .order('rank', { ascending: true })
        .limit(10);
    
    const container = document.getElementById('leaderboard-content');
    if (!data) {
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