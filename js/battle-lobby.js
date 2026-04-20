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
    if (!user) {
        alert('Please log in first');
        return;
    }
    
    const type = document.getElementById('battle-type').value;
    const code = generateBattleCode();
    
    console.log('Creating battle:', { host_id: user.id, battle_code: code, type });
    
    const { data, error } = await supabase
        .from('battles')
        .insert({
            host_id: user.id,
            battle_code: code,
            type: type,
            status: 'waiting',
            max_health: type === 'quick' ? 10 : type === 'epic' ? 30 : 20,
            player1_id: user.id,
            player1_health: type === 'quick' ? 10 : type === 'epic' ? 30 : 20
        })
        .select()
        .single();
    
    if (error) {
        console.error('Battle creation error:', error);
        alert('Failed to create battle: ' + error.message + '\nCode: ' + error.code);
        return;
    }
    
    console.log('Battle created:', data);
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
                console.log('Battle updated:', payload);
                if (payload.new.guest_id && payload.new.status === 'ready') {
                    window.location.href = `battle.html?battle=${data.id}&code=${code}&host=1`;
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
    
    const { error } = await supabase.from('battles').delete().eq('id', currentBattleId);
    
    if (error) {
        console.error('Cancel error:', error);
    }
    
    if (battleChannel) {
        supabase.removeChannel(battleChannel);
    }
    
    document.getElementById('host-code-display').classList.add('hidden');
    document.querySelector('.host-options').classList.remove('hidden');
    currentBattleId = null;
}

async function joinBattle() {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (!code || code.length < 4) {
        alert('Please enter a valid battle code');
        return;
    }
    
    const user = await getCurrentUser();
    if (!user) {
        alert('Please log in first');
        return;
    }
    
    document.getElementById('join-code-display').textContent = code;
    document.getElementById('join-modal').classList.remove('hidden');
    
    console.log('Looking for battle with code:', code);
    
    // Find battle by code
    const { data: battle, error } = await supabase
        .from('battles')
        .select('*')
        .eq('battle_code', code)
        .eq('status', 'waiting')
        .is('guest_id', null)
        .single();
    
    if (error) {
        console.error('Join error:', error);
        document.getElementById('join-modal').classList.add('hidden');
        alert('Battle not found or already started');
        return;
    }
    
    if (!battle) {
        document.getElementById('join-modal').classList.add('hidden');
        alert('Battle not found or already full');
        return;
    }
    
    if (battle.host_id === user.id) {
        document.getElementById('join-modal').classList.add('hidden');
        alert('You cannot join your own battle!');
        return;
    }
    
    console.log('Joining battle:', battle.id);
    
    // Join as guest
    const { error: updateError } = await supabase
        .from('battles')
        .update({
            guest_id: user.id,
            player2_id: user.id,
            player2_health: battle.max_health,
            status: 'ready'
        })
        .eq('id', battle.id)
        .eq('status', 'waiting')
        .is('guest_id', null);
    
    if (updateError) {
        console.error('Update error:', updateError);
        document.getElementById('join-modal').classList.add('hidden');
        alert('Failed to join: ' + updateError.message);
        return;
    }
    
    // Redirect to battle
    window.location.href = `battle.html?battle=${battle.id}&code=${code}&guest=1`;
}

async function findRandomOpponent() {
    const user = await getCurrentUser();
    if (!user) {
        alert('Please log in first');
        return;
    }
    
    // Look for waiting battles without a guest
    const { data: battles, error } = await supabase
        .from('battles')
        .select('*')
        .eq('status', 'waiting')
        .is('guest_id', null)
        .neq('host_id', user.id)
        .limit(10);
    
    if (error) {
        console.error('Find random error:', error);
        alert('Error finding battles: ' + error.message);
        return;
    }
    
    if (battles && battles.length > 0) {
        // Pick random battle
        const battle = battles[Math.floor(Math.random() * battles.length)];
        
        const { error: updateError } = await supabase
            .from('battles')
            .update({
                guest_id: user.id,
                player2_id: user.id,
                player2_health: battle.max_health,
                status: 'ready'
            })
            .eq('id', battle.id)
            .eq('status', 'waiting')
            .is('guest_id', null);
        
        if (updateError) {
            alert('Battle was taken, try again!');
            return;
        }
        
        window.location.href = `battle.html?battle=${battle.id}&code=${battle.battle_code}&guest=1`;
    } else {
        alert('No open battles found. Create your own and share the code!');
    }
}

// Load recent battles
async function loadRecentBattles() {
    const user = await getCurrentUser();
    if (!user) return;
    
    const { data: battles, error } = await supabase
        .from('battles')
        .select('*, winner:winner_id(username), host:host_id(username), guest:guest_id(username)')
        .or(`host_id.eq.${user.id},guest_id.eq.${user.id}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);
    
    if (error) {
        console.error('Recent battles error:', error);
    }
    
    const container = document.getElementById('recent-battles');
    
    if (!battles || battles.length === 0) {
        container.innerHTML = '<p class="empty">No recent battles</p>';
        return;
    }
    
    container.innerHTML = battles.map(b => {
        const isWin = b.winner_id === user.id;
        const isHost = b.host_id === user.id;
        const opponent = isHost ? (b.guest?.username || 'Unknown') : (b.host?.username || 'Unknown');
        return `
            <div class="recent-item">
                <span>${b.type} vs ${opponent}</span>
                <span class="result ${isWin ? 'win' : 'loss'}">${isWin ? 'Victory' : 'Defeat'}</span>
            </div>
        `;
    }).join('');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadRecentBattles();
});