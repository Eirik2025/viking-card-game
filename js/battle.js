import { supabase, getCurrentUser, signOut } from './supabase-client.js';

// Expose to window for HTML onclick
window.signOut = signOut;
window.endTurn = endTurn;
window.toggleLog = toggleLog;
window.returnToLobby = returnToLobby;
window.modifyStat = modifyStat;
window.getCustomAmount = getCustomAmount;
window.rollDice = rollDice;
window.flipCoin = flipCoin;

// Battle State
let battleId = null;
let battleConfig = {};
let isHost = false;
let myPlayerNum = 1;
let currentTurn = 1;

// Player Data - Single value system
let myStats = { value: 0, max: 0 };
let opponentStats = { value: 0, max: 0 };
let battleLog = [];

// Subscription
let battleSub = null;

async function initBattle() {
    const params = new URLSearchParams(window.location.search);
    battleId = params.get('battle');
    const code = params.get('code');
    isHost = params.has('host');

    if (!battleId) {
        alert('No battle specified');
        window.location.href = 'battle-lobby.html';
        return;
    }

    // Load Battle Data
    const { data: battle, error } = await supabase
        .from('battles')
        .select('*, host:host_id(*), guest:guest_id(*)')
        .eq('id', battleId)
        .single();

    if (error || !battle) {
        alert('Battle not found');
        window.location.href = 'battle-lobby.html';
        return;
    }

    battleConfig = battle.config || {};
    document.getElementById('display-code').textContent = code || '----';

    // Determine Player Number
    const user = await getCurrentUser();
    if (isHost) {
        myPlayerNum = 1;
        document.getElementById('player-name').textContent = battle.host?.username || 'You';
        document.getElementById('opponent-name').textContent = battle.guest?.username || 'Opponent';
    } else {
        myPlayerNum = 2;
        document.getElementById('player-name').textContent = 'You';
        document.getElementById('opponent-name').textContent = battle.host?.username || 'Opponent';
    }

    // Initialize Stats
    initializeStats(battle);

    // Setup UI
    setupBattleUI();

    // Subscribe to Changes
    subscribeToBattle();

    // Add Initial Log
    addLogEntry('system', 'Battle Started!');
}

function initializeStats(battle) {
    const startValue = getStartingValue();
    
    if (myPlayerNum === 1) {
        myStats = {
            value: battle.player1_health || startValue,
            max: startValue
        };
        opponentStats = {
            value: battle.player2_health || startValue,
            max: startValue
        };
    } else {
        myStats = {
            value: battle.player2_health || startValue,
            max: startValue
        };
        opponentStats = {
            value: battle.player1_health || startValue,
            max: startValue
        };
    }

    currentTurn = battle.current_turn || 1;
    updateUI();
}

function getStartingValue() {
    if (battleConfig.useHp) {
        return (battleConfig.hpValue || 20) * (battleConfig.hpCount || 1);
    }
    if (battleConfig.useLife) {
        return battleConfig.startLife || 8000;
    }
    if (battleConfig.useTrophies) {
        return 0;
    }
    return 20;
}

function setupBattleUI() {
    let statLabel = 'HP';
    if (battleConfig.useLife) statLabel = 'LIFE';
    if (battleConfig.useTrophies) statLabel = 'TROPHIES';
    
    document.getElementById('player-stat-label').textContent = statLabel;
    document.getElementById('opponent-stat-label').textContent = statLabel;
    
    document.getElementById('player-stat-max').textContent = `/ ${myStats.max}`;
    document.getElementById('opponent-stat-max').textContent = `/ ${opponentStats.max}`;
    
    const diceTool = document.getElementById('dice-tool');
    const coinTool = document.getElementById('coin-tool');
    
    if (diceTool) diceTool.style.display = battleConfig.useDice ? 'block' : 'none';
    if (coinTool) coinTool.style.display = battleConfig.useCoins ? 'block' : 'none';
}

function updateUI() {
    const playerValueEl = document.getElementById('player-stat-value');
    const opponentValueEl = document.getElementById('opponent-stat-value');
    
    if (playerValueEl) playerValueEl.textContent = myStats.value;
    if (opponentValueEl) opponentValueEl.textContent = opponentStats.value;
    
    updateStatBoxVisual('player-stat-box', myStats.value, myStats.max);
    updateStatBoxVisual('opponent-stat-box', opponentStats.value, opponentStats.max);
    
    const indicator = document.getElementById('turn-display');
    indicator.textContent = currentTurn === myPlayerNum ? 'Your Turn' : 'Opponent Turn';
    indicator.className = currentTurn === myPlayerNum ? 'turn-display active' : 'turn-display';
    
    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        endTurnBtn.disabled = currentTurn !== myPlayerNum;
        endTurnBtn.style.opacity = currentTurn !== myPlayerNum ? '0.5' : '1';
    }
    
    const playerControls = document.querySelector('#player-stat-box .stat-controls');
    if (playerControls) {
        if (currentTurn !== myPlayerNum) {
            playerControls.classList.add('disabled');
        } else {
            playerControls.classList.remove('disabled');
        }
    }
}

function updateStatBoxVisual(boxId, value, max) {
    const box = document.getElementById(boxId);
    if (!box) return;
    
    box.classList.remove('critical', 'low', 'healthy');
    
    const ratio = value / max;
    if (ratio <= 0.25) {
        box.classList.add('critical');
    } else if (ratio <= 0.5) {
        box.classList.add('low');
    } else {
        box.classList.add('healthy');
    }
}

function getCustomAmount() {
    const input = document.getElementById('custom-amount');
    return parseInt(input?.value) || 1;
}

async function modifyStat(change) {
    if (currentTurn !== myPlayerNum) {
        alert("Not your turn!");
        return;
    }
    
    let newValue;
    if (battleConfig.useTrophies) {
        newValue = Math.max(0, Math.min(myStats.max, myStats.value + change));
    } else {
        newValue = Math.max(0, myStats.value + change);
    }
    
    myStats.value = newValue;
    
    const updateData = myPlayerNum === 1 
        ? { player1_health: newValue } 
        : { player2_health: newValue };
    
    const { error } = await supabase.from('battles').update(updateData).eq('id', battleId);
    
    if (error) {
        console.error('Update error:', error);
        alert('Failed to update: ' + error.message);
        return;
    }
    
    updateUI();
    checkWinCondition();
    
    const action = change > 0 ? 'Gained' : 'Lost';
    const statName = battleConfig.useLife ? 'Life' : battleConfig.useTrophies ? 'Trophy' : 'HP';
    addLogEntry('player', `${action} ${Math.abs(change)} ${statName}`);
}

function rollDice(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    const resultDiv = document.getElementById('dice-result');
    if (resultDiv) {
        resultDiv.textContent = `🎲 d${sides}: ${result}`;
        resultDiv.classList.add('rolling');
        setTimeout(() => resultDiv.classList.remove('rolling'), 500);
    }
    addLogEntry('system', `Rolled d${sides}: ${result}`);
}

function flipCoin() {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    const resultDiv = document.getElementById('coin-result');
    if (resultDiv) {
        resultDiv.textContent = `🪙 ${result}`;
    }
    addLogEntry('system', `Coin flip: ${result}`);
}

async function endTurn() {
    if (currentTurn !== myPlayerNum) return;
    
    const nextTurn = myPlayerNum === 1 ? 2 : 1;
    
    const { error } = await supabase
        .from('battles')
        .update({ current_turn: nextTurn })
        .eq('id', battleId);
    
    if (error) {
        console.error('End turn error:', error);
        return;
    }
    
    addLogEntry('system', 'Turn ended');
}

function checkWinCondition() {
    let winner = null;
    let reason = '';
    
    if (!battleConfig.useTrophies) {
        if (myStats.value <= 0) {
            winner = myPlayerNum === 1 ? 2 : 1;
            reason = `${battleConfig.useLife ? 'Life' : 'HP'} depleted`;
        } else if (opponentStats.value <= 0) {
            winner = myPlayerNum;
            reason = `Opponent ${battleConfig.useLife ? 'Life' : 'HP'} depleted`;
        }
    }
    
    if (battleConfig.useTrophies) {
        const target = battleConfig.trophyCount || 6;
        if (myStats.value >= target) {
            winner = myPlayerNum;
            reason = 'All trophies claimed';
        } else if (opponentStats.value >= target) {
            winner = myPlayerNum === 1 ? 2 : 1;
            reason = 'Opponent claimed all trophies';
        }
    }
    
    if (winner) {
        endBattle(winner, reason);
    }
}

async function endBattle(winner, reason) {
    const iWon = winner === myPlayerNum;
    const user = await getCurrentUser();
    
    const { error } = await supabase.from('battles').update({
        status: 'completed',
        winner_id: iWon ? user.id : null,
        ended_at: new Date().toISOString()
    }).eq('id', battleId);
    
    if (error) {
        console.error('End battle error:', error);
    }
    
    const modal = document.getElementById('win-modal');
    const title = document.getElementById('win-title');
    const message = document.getElementById('win-message');
    const stats = document.getElementById('win-stats');
    
    if (iWon) {
        title.textContent = '🏆 Victory!';
        title.style.color = 'var(--success)';
        message.textContent = `You won by ${reason}!`;
        await supabase.rpc('increment_wins', { user_id: user.id });
    } else {
        title.textContent = '💀 Defeat';
        title.style.color = 'var(--accent)';
        message.textContent = `You lost by ${reason}`;
    }
    
    const statLabel = battleConfig.useLife ? 'Life' : battleConfig.useTrophies ? 'Trophies' : 'HP';
    stats.innerHTML = `
        <div class="stat-row"><span>Final ${statLabel}:</span><span>${myStats.value}</span></div>
        <div class="stat-row"><span>Max ${statLabel}:</span><span>${myStats.max}</span></div>
    `;
    
    modal.classList.remove('hidden');
    
    if (battleSub) {
        battleSub.unsubscribe();
    }
}

function subscribeToBattle() {
    battleSub = supabase
        .channel(`battle:${battleId}`)
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'battles', filter: `id=eq.${battleId}` },
            async (payload) => {
                const newData = payload.new;
                
                if (newData.current_turn !== undefined) {
                    currentTurn = newData.current_turn;
                }
                
                if (myPlayerNum === 1) {
                    opponentStats.value = newData.player2_health || opponentStats.value;
                } else {
                    opponentStats.value = newData.player1_health || opponentStats.value;
                }
                
                if (newData.status === 'completed') {
                    if (!document.getElementById('win-modal').classList.contains('hidden')) return;
                    
                    const user = await getCurrentUser();
                    const iWon = newData.winner_id === user.id;
                    
                    const modal = document.getElementById('win-modal');
                    const title = document.getElementById('win-title');
                    const message = document.getElementById('win-message');
                    
                    if (iWon) {
                        title.textContent = '🏆 Victory!';
                        message.textContent = 'Opponent conceded or was defeated!';
                    } else {
                        title.textContent = '💀 Defeat';
                        message.textContent = 'Better luck next time!';
                    }
                    
                    modal.classList.remove('hidden');
                    return;
                }
                
                updateUI();
            }
        )
        .subscribe();
}

function addLogEntry(type, message) {
    const container = document.getElementById('log-messages');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
    
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
    
    battleLog.push({ type, message, time });
}

function toggleLog() {
    const log = document.getElementById('battle-log');
    log.classList.toggle('collapsed');
}

function returnToLobby() {
    if (battleSub) {
        battleSub.unsubscribe();
    }
    window.location.href = 'battle-lobby.html';
}

// Initialize on load
initBattle();