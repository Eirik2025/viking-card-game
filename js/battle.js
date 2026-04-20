import { supabase, getCurrentUser, signOut } from './supabase-client.js';

// Expose functions to window
window.signOut = signOut;
window.adjustPlayerStat = adjustPlayerStat;
window.adjustOpponentStat = adjustOpponentStat;
window.awardTrophy = awardTrophy;
window.rollDice = rollDice;
window.flipCoin = flipCoin;
window.startTimer = startTimer;
window.endTurn = endTurn;
window.toggleLog = toggleLog;
window.returnToLobby = returnToLobby;

// Battle state
let battleId = null;
let battleCode = null;
let isHost = false;
let config = {};
let playerId = null;
let opponentId = null;
let currentTurn = null;

// Player stats
let playerStats = {};
let opponentStats = {};

// Timer
let timerInterval = null;
let timeRemaining = 60;

async function initBattle() {
    const params = new URLSearchParams(window.location.search);
    battleId = params.get('battle');
    battleCode = params.get('code');
    isHost = params.has('host');
    
    if (!battleId) {
        alert('No battle specified');
        window.location.href = 'battle-lobby.html';
        return;
    }
    
    // Load battle data
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
    
    // Set config
    config = battle.config || {};
    document.getElementById('display-code').textContent = battleCode;
    
    // Determine player/opponent
    const user = await getCurrentUser();
    playerId = user.id;
    
    if (isHost) {
        opponentId = battle.guest_id;
        document.getElementById('player-name').textContent = battle.host?.username || 'You';
        document.getElementById('opponent-name').textContent = battle.guest?.username || 'Opponent';
    } else {
        opponentId = battle.host_id;
        document.getElementById('player-name').textContent = battle.guest?.username || 'You';
        document.getElementById('opponent-name').textContent = battle.host?.username || 'Opponent';
    }
    
    // Initialize stats based on config
    initializeStats(battle);
    
    // Setup UI based on config
    setupUI();
    
    // Subscribe to battle updates
    subscribeToBattle();
    
    // Add initial log entry
    addLogEntry('system', `Battle started! ${config.style?.toUpperCase() || 'STANDARD'} mode.`);
}

function initializeStats(battle) {
    // Player stats
    if (config.useHealth) {
        playerStats.health = isHost ? battle.player1_health : battle.player2_health;
    }
    if (config.useLife) {
        playerStats.life = isHost ? battle.player1_life : battle.player2_life;
    }
    if (config.useTrophies) {
        playerStats.trophies = isHost ? (battle.player1_trophies || 0) : (battle.player2_trophies || 0);
    }
    
    // Opponent stats
    if (config.useHealth) {
        opponentStats.health = isHost ? battle.player2_health : battle.player1_health;
    }
    if (config.useLife) {
        opponentStats.life = isHost ? battle.player2_life : battle.player1_life;
    }
    if (config.useTrophies) {
        opponentStats.trophies = isHost ? (battle.player2_trophies || 0) : (battle.player1_trophies || 0);
    }
    
    updateStatsDisplay();
}

function setupUI() {
    // Show/hide controls based on config
    if (config.useHealth || config.useLife) {
        document.getElementById('health-controls').classList.remove('hidden');
    } else {
        document.getElementById('health-controls').classList.add('hidden');
    }
    
    if (config.useTrophies) {
        document.getElementById('trophy-controls').classList.remove('hidden');
    } else {
        document.getElementById('trophy-controls').classList.add('hidden');
    }
    
    if (config.useDice) {
        document.getElementById('dice-tool').classList.remove('hidden');
    } else {
        document.getElementById('dice-tool').classList.add('hidden');
    }
    
    if (config.useCoin) {
        document.getElementById('coin-tool').classList.remove('hidden');
    } else {
        document.getElementById('coin-tool').classList.add('hidden');
    }
    
    if (config.useTimer) {
        document.getElementById('timer-tool').classList.remove('hidden');
    } else {
        document.getElementById('timer-tool').classList.add('hidden');
    }
}

function updateStatsDisplay() {
    const playerContainer = document.getElementById('player-stats');
    const opponentContainer = document.getElementById('opponent-stats');
    
    // Build player stats HTML
    let playerHTML = '';
    if (config.useHealth && playerStats.health !== null) {
        playerHTML += createStatBox('Health', playerStats.health, 'health');
    }
    if (config.useLife && playerStats.life !== null) {
        playerHTML += createStatBox('Life', playerStats.life, 'life');
    }
    if (config.useTrophies && playerStats.trophies !== null) {
        playerHTML += createStatBox('Trophies', playerStats.trophies, 'trophies');
        document.getElementById('player-trophies').querySelector('.trophy-count').textContent = playerStats.trophies;
    }
    playerContainer.innerHTML = playerHTML;
    
    // Build opponent stats HTML
    let opponentHTML = '';
    if (config.useHealth && opponentStats.health !== null) {
        opponentHTML += createStatBox('Health', opponentStats.health, 'health');
    }
    if (config.useLife && opponentStats.life !== null) {
        opponentHTML += createStatBox('Life', opponentStats.life, 'life');
    }
    if (config.useTrophies && opponentStats.trophies !== null) {
        opponentHTML += createStatBox('Trophies', opponentStats.trophies, 'trophies');
        document.getElementById('opponent-trophies').querySelector('.trophy-count').textContent = opponentStats.trophies;
    }
    opponentContainer.innerHTML = opponentHTML;
}

function createStatBox(label, value, type) {
    const colorClass = type === 'health' ? 'health-stat' : type === 'life' ? 'life-stat' : 'trophy-stat';
    return `
        <div class="stat-box ${colorClass}">
            <span class="stat-value">${value}</span>
            <span class="stat-label">${label}</span>
        </div>
    `;
}

// Stat adjustment functions
async function adjustPlayerStat(statType, operation) {
    const amount = parseInt(document.getElementById('health-amount').value) || 1;
    const actualStat = statType === 'health' && config.useLife ? 'life' : statType;
    
    if (operation === 'add') {
        playerStats[actualStat] = (playerStats[actualStat] || 0) + amount;
    } else {
        playerStats[actualStat] = Math.max(0, (playerStats[actualStat] || 0) - amount);
    }
    
    await syncStats();
    updateStatsDisplay();
    checkWinCondition();
    
    addLogEntry('player', `${operation === 'add' ? 'Gained' : 'Lost'} ${amount} ${actualStat}`);
}

async function adjustOpponentStat(statType, operation) {
    const amount = parseInt(document.getElementById('health-amount').value) || 1;
    const actualStat = statType === 'health' && config.useLife ? 'life' : statType;
    
    if (operation === 'add') {
        opponentStats[actualStat] = (opponentStats[actualStat] || 0) + amount;
    } else {
        opponentStats[actualStat] = Math.max(0, (opponentStats[actualStat] || 0) - amount);
    }
    
    await syncStats();
    updateStatsDisplay();
    checkWinCondition();
    
    addLogEntry('player', `${operation === 'add' ? 'Healed opponent' : 'Damaged opponent'} for ${amount} ${actualStat}`);
}

async function awardTrophy(target) {
    const stats = target === 'player' ? playerStats : opponentStats;
    stats.trophies = (stats.trophies || 0) + 1;
    
    await syncStats();
    updateStatsDisplay();
    checkWinCondition();
    
    addLogEntry(target === 'player' ? 'player' : 'opponent', `Awarded a trophy! (${stats.trophies} total)`);
}

async function syncStats() {
    const updateData = {};
    
    if (isHost) {
        if (config.useHealth) updateData.player1_health = playerStats.health;
        if (config.useLife) updateData.player1_life = playerStats.life;
        if (config.useTrophies) updateData.player1_trophies = playerStats.trophies;
        if (config.useHealth) updateData.player2_health = opponentStats.health;
        if (config.useLife) updateData.player2_life = opponentStats.life;
        if (config.useTrophies) updateData.player2_trophies = opponentStats.trophies;
    } else {
        if (config.useHealth) updateData.player2_health = playerStats.health;
        if (config.useLife) updateData.player2_life = playerStats.life;
        if (config.useTrophies) updateData.player2_trophies = playerStats.trophies;
        if (config.useHealth) updateData.player1_health = opponentStats.health;
        if (config.useLife) updateData.player1_life = opponentStats.life;
        if (config.useTrophies) updateData.player1_trophies = opponentStats.trophies;
    }
    
    await supabase.from('battles').update(updateData).eq('id', battleId);
}

// Tools
function rollDice(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    document.getElementById('dice-result').textContent = `🎲 d${sides}: ${result}`;
    addLogEntry('system', `Rolled d${sides}: ${result}`);
}

function flipCoin() {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    document.getElementById('coin-result').textContent = `🪙 ${result}`;
    addLogEntry('system', `Coin flip: ${result}`);
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timeRemaining = 60;
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        document.getElementById('timer-display').textContent = timeRemaining;
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            addLogEntry('system', 'Turn timer expired!');
            alert('Time\'s up!');
        }
    }, 1000);
    
    addLogEntry('system', 'Turn timer started (60 seconds)');
}

function endTurn() {
    if (timerInterval) clearInterval(timerInterval);
    addLogEntry('system', 'Turn ended');
    // Would sync turn change here
}

// Win condition check
function checkWinCondition() {
    let playerWon = false;
    let opponentWon = false;
    let winReason = '';
    
    if (config.winCondition === 'zero') {
        // Win by reducing opponent to zero
        if (config.useHealth && opponentStats.health === 0) {
            playerWon = true;
            winReason = 'Health depleted';
        }
        if (config.useLife && opponentStats.life === 0) {
            playerWon = true;
            winReason = 'Life reached zero';
        }
        if (config.useHealth && playerStats.health === 0) {
            opponentWon = true;
            winReason = 'Your health depleted';
        }
        if (config.useLife && playerStats.life === 0) {
            opponentWon = true;
            winReason = 'Your life reached zero';
        }
    } else if (config.winCondition === 'max') {
        // Win by reaching max value
        const max = config.startValue * 2;
        if (config.useHealth && playerStats.health >= max) {
            playerWon = true;
            winReason = `Reached ${max} health`;
        }
        if (config.useLife && playerStats.life >= max) {
            playerWon = true;
            winReason = `Reached ${max} life`;
        }
    } else if (config.winCondition === 'trophies') {
        // Win by collecting all trophies
        const needed = config.startValue; // startValue used as trophy target
        if (playerStats.trophies >= needed) {
            playerWon = true;
            winReason = `Collected ${needed} trophies`;
        }
        if (opponentStats.trophies >= needed) {
            opponentWon = true;
            winReason = `Opponent collected ${needed} trophies`;
        }
    }
    
    if (playerWon) {
        showWinModal(true, winReason);
    } else if (opponentWon) {
        showWinModal(false, winReason);
    }
}

function showWinModal(victory, reason) {
    const modal = document.getElementById('win-modal');
    const title = document.getElementById('win-title');
    const message = document.getElementById('win-message');
    const stats = document.getElementById('win-stats');
    
    if (victory) {
        title.textContent = 'VICTORY! 🏆';
        title.style.color = 'var(--success)';
        message.textContent = `You defeated your opponent! ${reason}`;
    } else {
        title.textContent = 'DEFEAT...';
        title.style.color = 'var(--accent)';
        message.textContent = `You have fallen. ${reason}`;
    }
    
    // Build final stats
    let statsHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1.5rem 0;">';
    statsHTML += `<div><strong>You:</strong> ${config.useHealth ? playerStats.health + ' HP' : ''} ${config.useLife ? playerStats.life + ' Life' : ''} ${config.useTrophies ? playerStats.trophies + ' 🏆' : ''}</div>`;
    statsHTML += `<div><strong>Opponent:</strong> ${config.useHealth ? opponentStats.health + ' HP' : ''} ${config.useLife ? opponentStats.life + ' Life' : ''} ${config.useTrophies ? opponentStats.trophies + ' 🏆' : ''}</div>`;
    statsHTML += '</div>';
    stats.innerHTML = statsHTML;
    
    modal.classList.remove('hidden');
    
    // Update battle status
    supabase.from('battles').update({
        status: 'completed',
        winner_id: victory ? playerId : opponentId
    }).eq('id', battleId);
}

// Battle log
function addLogEntry(type, message) {
    const container = document.getElementById('log-messages');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    entry.innerHTML = `<span style="color:var(--text-muted);">[${time}]</span> ${message}`;
    
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

function toggleLog() {
    const log = document.getElementById('log-messages');
    log.style.display = log.style.display === 'none' ? 'block' : 'none';
}

function returnToLobby() {
    window.location.href = 'battle-lobby.html';
}

// Real-time subscription
function subscribeToBattle() {
    supabase
        .channel(`battle:${battleId}`)
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'battles', filter: `id=eq.${battleId}` },
            (payload) => {
                const newData = payload.new;
                
                // Update opponent stats from server
                if (isHost) {
                    if (config.useHealth) opponentStats.health = newData.player2_health;
                    if (config.useLife) opponentStats.life = newData.player2_life;
                    if (config.useTrophies) opponentStats.trophies = newData.player2_trophies;
                } else {
                    if (config.useHealth) opponentStats.health = newData.player1_health;
                    if (config.useLife) opponentStats.life = newData.player1_life;
                    if (config.useTrophies) opponentStats.trophies = newData.player1_trophies;
                }
                
                updateStatsDisplay();
                checkWinCondition();
            }
        )
        .subscribe();
}

// Initialize
initBattle();