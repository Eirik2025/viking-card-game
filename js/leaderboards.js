import { supabase } from './supabase-client.js';

async function loadLeaderboard(type = 'wins') {
    let query = supabase.from('profiles').select('username, total_wins, level, experience, prestige_level');
    
    if (type === 'wins') {
        query = query.order('total_wins', { ascending: false });
    } else if (type === 'level') {
        query = query.order('level', { ascending: false }).order('experience', { ascending: false });
    } else if (type === 'prestige') {
        query = query.order('prestige_level', { ascending: false });
    }
    
    const { data } = await query.limit(50);
    
    if (data && data.length >= 1) {
        document.getElementById('p1-name').textContent = data[0].username;
        document.getElementById('p1-score').textContent = type === 'prestige' ? `★${data[0].prestige_level}` : data[0][type === 'wins' ? 'total_wins' : 'level'];
    }
    if (data && data.length >= 2) {
        document.getElementById('p2-name').textContent = data[1].username;
        document.getElementById('p2-score').textContent = type === 'prestige' ? `★${data[1].prestige_level}` : data[1][type === 'wins' ? 'total_wins' : 'level'];
    }
    if (data && data.length >= 3) {
        document.getElementById('p3-name').textContent = data[2].username;
        document.getElementById('p3-score').textContent = type === 'prestige' ? `★${data[2].prestige_level}` : data[2][type === 'wins' ? 'total_wins' : 'level'];
    }
    
    const container = document.getElementById('leaderboard-table');
    container.innerHTML = `
        <div class="lb-row header">
            <div>Rank</div>
            <div>Player</div>
            <div>${type === 'prestige' ? 'Prestige' : type === 'level' ? 'Level' : 'Wins'}</div>
            <div>Details</div>
        </div>
    `;
    
    (data || []).slice(3).forEach((player, index) => {
        const value = type === 'prestige' ? player.prestige_level : type === 'level' ? player.level : player.total_wins;
        const detail = type === 'prestige' ? `${player.total_wins} Wins` : type === 'level' ? `${player.experience} XP` : `Level ${player.level}`;
        
        container.innerHTML += `
            <div class="lb-row">
                <div class="lb-rank">#${index + 4}</div>
                <div>${player.username}</div>
                <div>${type === 'prestige' ? `<span class="prestige-badge">★ ${value}</span>` : value}</div>
                <div>${detail}</div>
            </div>
        `;
    });
}

document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        loadLeaderboard(e.target.dataset.board);
    });
});

loadLeaderboard();