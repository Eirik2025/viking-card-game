import { supabase, getCurrentUser, signOut } from './supabase-client.js';

window.signOut = signOut;
window.hostBattle = hostBattle;
window.copyCode = copyCode;
window.cancelHost = cancelHost;
window.joinBattle = joinBattle;
window.findRandomOpponent = findRandomOpponent;

let currentBattleId = null;
let battleChannel = null;

function generateBattleCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function hostBattle() {
    const user = await getCurrentUser();
    const type = document.getElementById('battle-type').value;
    const code = generateBattleCode();
    
    const { data, error } = await supabase
        .from('battles')
        .insert({
            host_id: user.id,
            battle_code: code,
            type: type,
            status: 'waiting',
            max_health: type === 'quick' ? 10 : type === 'epic' ? 30 : 20
        })
        .select()
        .single();
    
    if (error) {
        alert('Failed to create battle: ' + error.message);
        return;
    }
    
    currentBattleId = data.id;
    
    // Show code
    document.getElementById('battle-code').textContent = code;
    document.getElementById('host-code-display').classList.remove('hidden');
    document.querySelector('.host-options').classList.add('hidden');
    
    // Listen for opponent joining
    battleChannel = supabase
        .channel(`battle:${code}`)
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'battles', filter: `id=eq.${data.id}` },
            (payload) => {
                if (payload.new.guest_id && payload.new.status === 'ready') {
                    window.location.href = `battle.html?battle=${data.id}&code=${code}`;
                }
            }
        )
        .subscribe();
}

function copyCode() {
    const code = document.getElementById('battle-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        alert('Code copied to clipboard!');
    });
}

async function cancelHost() {
    if (!currentBattleId) return;
    
    await supabase.from('battles').delete().eq('id', currentBattleId);
    
    if (battleChannel) {
        supabase.removeChannel(battleChannel);
    }
    
    document.getElementById('host-code-display').classList.add('hidden');
    document.querySelector('.host-options').classList.remove('hidden');
    currentBattleId = null;
}

async function joinBattle() {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (!code || code.length !== 6) {
        alert('Please enter a valid 6-character battle code');
        return;
    }
    
    const user = await getCurrentUser();
    
    document.getElementById('join-code-display').textContent = code;
    document.getElementById('join-modal').classList.remove('hidden');
    
    // Find battle by code
    const { data: battle, error } = await supabase
        .from('battles')
        .select('*')
        .eq('battle_code', code)
        .eq('status', 'waiting')
        .single();
    
    if (error || !battle) {
        document.getElementById('join-modal').classList.add('hidden');
        alert('Battle not found or already started');
        return;
    }
    
    if (battle.host_id === user.id) {
        document.getElementById('join-modal').classList.add('hidden');
        alert('You cannot join your own battle!');
        return;
    }
    
    // Join as guest
    await supabase
        .from('battles')
        .update({
            guest_id: user.id,
            status: 'ready'
        })
        .eq('id', battle.id);
    
    // Notify host and redirect
    window.location.href = `battle.html?battle=${battle.id}&code=${code}&guest=1`;
}

async function findRandomOpponent() {
    const user = await getCurrentUser();
    
    // Look for waiting battles without a guest
    const { data: battles } = await supabase
        .from('battles')
        .select('*')
        .eq('status', 'waiting')
        .is('guest_id', null)
        .neq('host_id', user.id)
        .limit(1);
    
    if (battles && battles.length > 0) {
        const battle = battles[0];
        
        await supabase
            .from('battles')
            .update({
                guest_id: user.id,
                status: 'ready'
            })
            .eq('id', battle.id);
        
        window.location.href = `battle.html?battle=${battle.id}&code=${battle.battle_code}&guest=1`;
    } else {
        // No battles available - create one and wait
        alert('No open battles found. Create your own and share the code!');
    }
}

// Load recent battles
async function loadRecentBattles() {
    const user = await getCurrentUser();
    
    const { data: battles } = await supabase
        .from('battles')
        .select('*, winner:winner_id(username)')
        .or(`host_id.eq.${user.id},guest_id.eq.${user.id}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);
    
    const container = document.getElementById('recent-battles');
    
    if (!battles || battles.length === 0) {
        container.innerHTML = '<p class="empty">No recent battles</p>';
        return;
    }
    
    container.innerHTML = battles.map(b => {
        const isWin = b.winner_id === user.id;
        const opponent = b.host_id === user.id ? 'Guest' : 'Host';
        return `
            <div class="recent-item">
                <span>${b.type} vs ${opponent}</span>
                <span class="result ${isWin ? 'win' : 'loss'}">${isWin ? 'Victory' : 'Defeat'}</span>
            </div>
        `;
    }).join('');
}

loadRecentBattles();