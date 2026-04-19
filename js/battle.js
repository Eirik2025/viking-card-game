import { supabase, getCurrentUser } from './supabase-client.js';

let playerHealth = 20;
let opponentHealth = 20;
const MAX_HEALTH = 20;
let battleId = null;
let battleOver = false;

function updateHealthDisplay(target) {
    const health = target === 'player' ? playerHealth : opponentHealth;
    const bar = document.getElementById(`${target}-health-bar`);
    const text = document.getElementById(`${target}-health`);
    
    const percentage = Math.max(0, (health / MAX_HEALTH) * 100);
    bar.style.width = `${percentage}%`;
    text.textContent = `${Math.max(0, health)}/${MAX_HEALTH}`;
    
    if (battleId && !battleOver) {
        supabase.from('battles').update({
            [`${target}_health`]: Math.max(0, health)
        }).eq('id', battleId).then();
    }
    
    checkWinCondition();
}

function checkWinCondition() {
    if (battleOver) return;
    
    if (playerHealth <= 0) {
        endBattle('opponent');
    } else if (opponentHealth <= 0) {
        endBattle('player');
    }
}

async function endBattle(winner) {
    battleOver = true;
    const user = await getCurrentUser();
    
    // Visual feedback
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); display: flex; flex-direction: column;
        align-items: center; justify-content: center; z-index: 9999;
        color: var(--primary); font-family: Cinzel, serif;
    `;
    
    const isPlayerWinner = winner === 'player';
    overlay.innerHTML = `
        <h1 style="font-size: 4rem; margin-bottom: 1rem;">${isPlayerWinner ? 'VICTORY' : 'DEFEAT'}</h1>
        <p style="font-size: 1.5rem; color: var(--text); margin-bottom: 2rem;">
            ${isPlayerWinner ? 'You crushed your opponent!' : 'You have fallen in battle...'}
        </p>
        <button onclick="window.location.href='index.html'" class="btn btn-primary" style="padding: 1rem 2rem; font-size: 1.2rem;">
            Return to Camp
        </button>
    `;
    document.body.appendChild(overlay);
    
    // Update DB if we have a battle ID
    if (battleId) {
        await supabase.from('battles').update({
            status: 'completed',
            winner_id: isPlayerWinner ? user.id : null // You'd need opponent ID here in real app
        }).eq('id', battleId);
    }
}

window.adjustHealth = function(target, amount) {
    if (battleOver) return;
    
    if (target === 'player') {
        playerHealth = Math.min(MAX_HEALTH, playerHealth + amount);
        updateHealthDisplay('player');
    } else {
        opponentHealth = Math.min(MAX_HEALTH, opponentHealth + amount);
        updateHealthDisplay('opponent');
    }
};

window.rollDice = function(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    document.getElementById('dice-result').textContent = result;
    addBattleMessage('System', `Rolled d${sides}: ${result}`);
};

window.flipCoin = function() {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    document.getElementById('coin-result').textContent = result;
    addBattleMessage('System', `Coin flip: ${result}`);
};

window.sendBattleMessage = async function() {
    const input = document.getElementById('battle-chat-input');
    const user = await getCurrentUser();
    if (!input.value.trim() || !battleId) return;
    
    await supabase.from('battle_chat').insert({
        battle_id: battleId,
        user_id: user.id,
        message: input.value
    });
    input.value = '';
};

function addBattleMessage(user, msg) {
    const container = document.getElementById('battle-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${user}:</strong> ${msg}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function initBattle() {
    const user = await getCurrentUser();
    document.getElementById('player-name').textContent = user.user_metadata?.username || 'You';
    
    // Create a local battle record for health sync (simplified)
    const { data } = await supabase.from('battles').insert({
        player1_id: user.id,
        player1_health: 20,
        player2_health: 20,
        status: 'active'
    }).select().single();
    
    if (data) battleId = data.id;
    
    supabase
        .channel('battle')
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'battles' },
            (payload) => {
                if (payload.new.id === battleId && !battleOver) {
                    opponentHealth = payload.new.player2_health;
                    updateHealthDisplay('opponent');
                }
            }
        )
        .subscribe();
}

initBattle();