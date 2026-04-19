import { supabase, getCurrentUser, signOut } from './supabase-client.js';

window.signOut = signOut;
window.joinTournament = joinTournament;
window.closeModal = closeModal;

async function loadTournaments(filter = 'all') {
    let query = supabase.from('tournaments').select('*');
    if (filter !== 'all') query = query.eq('status', filter);
    
    const { data: tournaments } = await query.order('created_at', { ascending: false });
    
    const container = document.getElementById('tournaments-list');
    container.innerHTML = (tournaments || []).map(t => `
        <div class="tournament-card">
            <span class="tournament-status status-${t.status}">${t.status}</span>
            <h3>${t.name}</h3>
            <div class="tournament-info">
                <div><span>Type:</span> <span>${t.type}</span></div>
                <div><span>Players:</span> <span>${t.current_players}/${t.max_players}</span></div>
                <div><span>Fee:</span> <span>${t.entry_fee} Gold</span></div>
                <div><span>Prize:</span> <span>${t.prize_pool} Gold</span></div>
            </div>
            <button class="btn btn-primary" onclick="joinTournament('${t.id}')">
                ${t.status === 'open' ? 'Join' : 'View'}
            </button>
        </div>
    `).join('');
}

async function joinTournament(tournamentId) {
    const user = await getCurrentUser();
    const { data: tournament } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();
    
    if (!tournament || tournament.current_players >= tournament.max_players) {
        alert('Tournament is full!');
        return;
    }
    
    await supabase.from('tournament_participants').insert({
        tournament_id: tournamentId,
        user_id: user.id
    });
    
    await supabase.rpc('increment_tournament_players', { tournament_id: tournamentId });
    alert('Joined successfully!');
    loadTournaments();
}

document.getElementById('create-tournament-btn').addEventListener('click', () => {
    document.getElementById('tournament-modal').classList.remove('hidden');
});

document.getElementById('confirm-tournament').addEventListener('click', async () => {
    const user = await getCurrentUser();
    const fee = parseInt(document.getElementById('tour-fee').value) || 0;
    const maxPlayers = parseInt(document.getElementById('tour-max').value) || 16;
    
    await supabase.from('tournaments').insert({
        name: document.getElementById('tour-name').value,
        type: document.getElementById('tour-type').value,
        max_players: maxPlayers,
        entry_fee: fee,
        host_id: user.id,
        status: 'open',
        prize_pool: fee * maxPlayers
    });
    
    closeModal();
    loadTournaments();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        loadTournaments(e.target.dataset.filter);
    });
});

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

loadTournaments();