import { supabase, getCurrentUser } from './supabase-client.js';

let playerHealth = 20;
let opponentHealth = 20;
const MAX_HEALTH = 20;
let battleId = null;

function updateHealthDisplay(target) {
    const health = target === 'player' ? playerHealth : opponentHealth;
    const bar = document.getElementById(`${target}-health-bar`);
    const text = document.getElementById(`${target}-health`);
    
    const percentage = (health / MAX_HEALTH) * 100;
    bar.style.width = `${percentage}%`;
    text.textContent = `${health}/${MAX_HEALTH}`;
    
    if (battleId) {
        supabase.from('battles').update({
            [`${target}_health`]: health
        }).eq('id', battleId).then();
    }
}

window.adjustHealth = function(target, amount) {
    if (target === 'player') {
        playerHealth = Math.max(0, Math.min(MAX_HEALTH, playerHealth + amount));
        updateHealthDisplay('player');
    } else {
        opponentHealth = Math.max(0, Math.min(MAX_HEALTH, opponentHealth + amount));
        updateHealthDisplay('opponent');
    }
};

window.rollDice = function(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    const display = document.getElementById('dice-result');
    display.textContent = result;
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
    document.getElementById('player-name').textContent = user.user_metadata.username || 'You';
    
    supabase
        .channel('battle')
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'battles' },
            (payload) => {
                if (payload.new.id === battleId) {
                    opponentHealth = payload.new.player2_health;
                    updateHealthDisplay('opponent');
                }
            }
        )
        .subscribe();
}

initBattle();