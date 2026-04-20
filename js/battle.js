import { supabase, getCurrentUser, signOut } from './supabase-client.js';

// Expose to window
window.signOut = signOut;
window.endTurn = endTurn;
window.toggleLog = toggleLog;
window.returnToLobby = returnToLobby;
window.modifyHp = modifyHp;
window.modifyLife = modifyLife;
window.modifyTrophies = modifyTrophies;
window.rollDice = rollDice;
window.flipCoin = flipCoin;

// Battle State
let battleId = null;
let battleConfig = {};
let isHost = false;
let myPlayerNum = 1; // 1 or 2
let currentTurn = 1;

// Player Data
let myStats = {};
let opponentStats = {};
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
    // Set Initial Values from Battle Record
    if (myPlayerNum === 1) {
        myStats = {
            hp: battle.player1_health || getStartingValue(),
            life: battle.player1_life || (battleConfig.startLife || 8000),
            trophies: battle.player1_trophies || 0
        };
        opponentStats = {
            hp: battle.player2_health || getStartingValue(),
            life: battle.player2_life || (battleConfig.startLife || 8000),
            trophies: battle.player2_trophies || 0
        };
    } else {
        myStats = {
            hp: battle.player2_health || getStartingValue(),
            life: battle.player2_life || (battleConfig.startLife || 8000),
            trophies: battle.player2_trophies || 0
        };
        opponentStats = {
            hp: battle.player1_health || getStartingValue(),
            life: battle.player1_life || (battleConfig.startLife || 8000),
            trophies: battle.player1_trophies || 0
        };
    }

    currentTurn = battle.current_turn || 1;
    updateUI();
}

function getStartingValue() {
    if (battleConfig.useHp) {
        return (battleConfig.hpValue || 20) * (battleConfig.hpCount || 20);
    }
    return battleConfig.startLife || 8000;
}

function setupBattleUI() {
    const zone = document.getElementById('battle-zone');
    zone.innerHTML = '';

    // Create UI based on Config
    if (battleConfig.useHp) {
        createHpBoxes(zone);
    }

    if (battleConfig.useLife) {
        createLifeDisplay(zone);
    }

    if (battleConfig.useTrophies) {
        createTrophyDisplay(zone);
    }

    // Always Add Tools
    createTools(zone);

    // Add Turn Controls
    const controls = document.createElement('div');
    controls.className = 'turn-controls';
    controls.innerHTML = `
        <button class="btn btn-primary" id="end-turn-btn" onclick="endTurn()">End Turn</button>
    `;
    zone.appendChild(controls);
}

function createHpBoxes(container) {
    const count = battleConfig.hpCount || 20;
    const hpPerBox = battleConfig.hpValue || 20;
    const totalHp = count * hpPerBox;

    // Store Max for Reference
    myStats.maxHp = totalHp;
    opponentStats.maxHp = totalHp;

    const wrapper = document.createElement('div');
    wrapper.className = 'hp-boxes';

    for (let i = 0; i < count; i++) {
        const box = document.createElement('div');
        box.className = 'hp-box';
        box.dataset.index = i;

        // Calculate HP range for this Box
        const boxStart = totalHp - ((i + 1) * hpPerBox);
        const boxEnd = totalHp - (i * hpPerBox);

        box.innerHTML = `
            <div class="hp-value">${boxStart}-${boxEnd}</div>
            <div class="hp-buttons">
                <button class="hp-btn" onclick="modifyHp(-${hpPerBox})">-</button>
                <button class="hp-btn" onclick="modifyHp(-1)">-1</button>
                <button class="hp-btn" onclick="modifyHp(1)">+1</button>
                <button class="hp-btn" onclick="modifyHp(${hpPerBox})">+${hpPerBox}</button>
            </div>
        `;

        wrapper.appendChild(box);
    }

    container.appendChild(wrapper);
    updateHpDisplay();
}

function createLifeDisplay(container) {
    const display = document.createElement('div');
    display.className = 'life-display';
    display.id = 'life-display';
    display.textContent = myStats.life || 8000;

    const buttons = document.createElement('div');
    buttons.className = 'life-buttons';
    buttons.innerHTML = `
        <button class="btn btn-health" onclick="modifyLife(-1000)">-1000</button>
        <button class="btn btn-health" onclick="modifyLife(-100)">-100</button>
        <button class="btn btn-health" onclick="modifyLife(100)">+100</button>
        <button class="btn btn-health" onclick="modifyLife(1000)">+1000</button>
    `;

    container.appendChild(display);
    container.appendChild(buttons);
    updateLifeDisplay();
}

function createTrophyDisplay(container) {
    const display = document.createElement('div');
    display.className = 'trophy-display';

    const count = battleConfig.trophyCount || 6;

    for (let i = 0; i < count; i++) {
        const card = document.createElement('div');
        card.className = 'trophy-card';
        card.dataset.index = i;
        card.innerHTML = `<div class="trophy-icon">🏆</div>`;
        card.onclick = () => modifyTrophies(1);
        display.appendChild(card);
    }

    container.appendChild(display);
    updateTrophyDisplay();
}

function createTools(container) {
    const panel = document.createElement('div');
    panel.className = 'controls-panel';

    // Dice Tool
    if (battleConfig.useDice) {
        const diceTool = document.createElement('div');
        diceTool.className = 'control-group';
        diceTool.innerHTML = `
            <h4>🎲 Dice Roller</h4>
            <div class="tool-buttons">
                ${[4,6,8,10,12,20].map(s => `<button class="btn btn-tool" onclick="rollDice(${s})">d${s}</button>`).join('')}
            </div>
            <div class="dice-result" id="dice-result">-</div>
        `;
        panel.appendChild(diceTool);
    }

    // Coin Tool
    if (battleConfig.useCoins) {
        const coinTool = document.createElement('div');
        coinTool.className = 'control-group';
        coinTool.innerHTML = `
            <h4>🪙 Coin Flip</h4>
            <button class="btn btn-tool btn-large" onclick="flipCoin()">Flip Coin</button>
            <div class="coin-result" id="coin-result">-</div>
        `;
        panel.appendChild(coinTool);
    }

    container.appendChild(panel);
}

// Update Functions
function updateUI() {
    // Update HP or Life
    if (battleConfig.useHp) {
        updateHpDisplay();
    } else if (battleConfig.useLife) {
        updateLifeDisplay();
    }

    // Update Trophies
    if (battleConfig.useTrophies) {
        updateTrophyDisplay();
    }

    // Update Turn Indicator
    const indicator = document.getElementById('turn-display');
    indicator.textContent = currentTurn === myPlayerNum ? 'Your Turn' : 'Opponent Turn';
    indicator.className = currentTurn === myPlayerNum ? 'turn-display active' : 'turn-display';

    // Update Button State
    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        endTurnBtn.disabled = currentTurn !== myPlayerNum;
    }
}

function updateHpDisplay() {
    if (!battleConfig.useHp) return;

    const boxes = document.querySelectorAll('.hp-box');
    const totalHp = (battleConfig.hpCount || 20) * (battleConfig.hpValue || 20);
    const myHp = myStats.hp || totalHp;
    const opponentHp = opponentStats.hp || totalHp;

    boxes.forEach((box, index) => {
        const boxStart = totalHp - ((index + 1) * (battleConfig.hpValue || 20));
        const boxEnd = totalHp - (index * (battleConfig.hpValue || 20));
        const isPlayerBox = myHp >= boxStart && myHp <= boxEnd;
        const isOpponentBox = opponentHp >= boxStart && opponentHp <= boxEnd;

        box.classList.remove('filled', 'empty');
        if (isPlayerBox || isOpponentBox) {
            box.classList.add('filled');
        } else {
            box.classList.add('empty');
        }

        // Update Value Display
        const valueDiv = box.querySelector('.hp-value');
        if (isPlayerBox) {
            valueDiv.textContent = myHp;
        } else if (isOpponentBox) {
            valueDiv.textContent = opponentHp;
        } else {
            valueDiv.textContent = `${boxStart}-${boxEnd}`;
        }
    });
}

function updateLifeDisplay() {
    if (!battleConfig.useLife) return;

    const display = document.getElementById('life-display');
    if (display) {
        display.textContent = myStats.life || 8000;
    }
}

function updateTrophyDisplay() {
    if (!battleConfig.useTrophies) return;

    const cards = document.querySelectorAll('.trophy-card');
    const myCount = myStats.trophies || 0;

    cards.forEach((card, index) => {
        card.classList.remove('taken');
        if (index < myCount) {
            card.classList.add('taken');
        }
    });
}

// Action Functions
async function modifyHp(change) {
    if (currentTurn !== myPlayerNum) {
        alert("Not your turn!");
        return;
    }

    const newHp = Math.max(0, (myStats.hp || 0) + change);
    myStats.hp = newHp;

    // Sync to Server
    const updateData = myPlayerNum === 1 ? { player1_health: newHp } : { player2_health: newHp };
    await supabase.from('battles').update(updateData).eq('id', battleId);

    updateUI();
    checkWinCondition();
    addLogEntry('player', `${change > 0 ? 'Gained' : 'Lost'} ${Math.abs(change)} HP`);
}

async function modifyLife(change) {
    if (currentTurn !== myPlayerNum) {
        alert("Not your turn!");
        return;
    }

    const newLife = Math.max(0, (myStats.life || 8000) + change);
    myStats.life = newLife;

    // Sync to Server
    const updateData = myPlayerNum === 1 ? { player1_life: newLife } : { player2_life: newLife };
    await supabase.from('battles').update(updateData).eq('id', battleId);

    updateUI();
    checkWinCondition();
    addLogEntry('player', `${change > 0 ? 'Gained' : 'Lost'} ${Math.abs(change)} Life Points`);
}

async function modifyTrophies(change) {
    if (currentTurn !== myPlayerNum) {
        alert("Not your turn!");
        return;
    }

    const newTrophies = Math.max(0, Math.min((myStats.trophies || 0) + change, battleConfig.trophyCount || 6));
    myStats.trophies = newTrophies;

    // Sync to Server
    const updateData = myPlayerNum === 1 ? { player1_trophies: newTrophies } : { player2_trophies: newTrophies };
    await supabase.from('battles').update(updateData).eq('id', battleId);

    updateUI();
    checkWinCondition();
    addLogEntry('player', `Trophy ${change > 0 ? 'claimed' : 'lost'}!`);
}

function rollDice(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    const resultDiv = document.getElementById('dice-result');
    if (resultDiv) {
        resultDiv.textContent = `🎲 Rolled: ${result}`;
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

    await supabase.from('battles').update({ current_turn: nextTurn }).eq('id', battleId);

    addLogEntry('system', 'Turn ended');
}

function checkWinCondition() {
    let winner = null;
    let reason = '';

    // Check HP
    if (battleConfig.useHp) {
        if (myStats.hp <= 0) {
            winner = myPlayerNum === 1 ? 2 : 1;
            reason = 'HP depleted';
        } else if (opponentStats.hp <= 0) {
            winner = myPlayerNum;
            reason = 'Opponent HP depleted';
        }
    }

    // Check Life Points
    if (battleConfig.useLife) {
        if (myStats.life <= 0) {
            winner = myPlayerNum === 1 ? 2 : 1;
            reason = 'Life Points depleted';
        } else if (opponentStats.life <= 0) {
            winner = myPlayerNum;
            reason = 'Opponent Life Points depleted';
        }
    }

    // Check Trophies
    if (battleConfig.useTrophies) {
        const target = battleConfig.trophyCount || 6;
        if (myStats.trophies >= target) {
            winner = myPlayerNum;
            reason = 'All trophies claimed';
        } else if (opponentStats.trophies >= target) {
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

    // Get current user
    const user = await getCurrentUser();
    const winnerId = iWon ? user.id : null; // Note: In production, fetch opponent ID properly

    // Update battle status
    await supabase.from('battles').update({
        status: 'completed',
        winner_id: winnerId,
        ended_at: new Date().toISOString()
    }).eq('id', battleId);

    // Show win modal
    const modal = document.getElementById('win-modal');
    const title = document.getElementById('win-title');
    const message = document.getElementById('win-message');
    const stats = document.getElementById('win-stats');

    if (iWon) {
        title.textContent = '🏆 Victory!';
        title.style.color = 'var(--success)';
        message.textContent = `You won by ${reason}!`;

        // Update profile stats
        await supabase.rpc('increment_wins', { user_id: user.id });
    } else {
        title.textContent = '💀 Defeat';
        title.style.color = 'var(--accent)';
        message.textContent = `You lost by ${reason}`;
    }

    stats.innerHTML = `
        <div class="stat-row"><span>Final HP:</span><span>${myStats.hp || myStats.life || myStats.trophies}</span></div>
        <div class="stat-row"><span>Turns:</span><span>${battleLog.filter(l => l.type === 'system' && l.message.includes('Turn')).length}</span></div>
    `;

    modal.classList.remove('hidden');

    // Cleanup subscription
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

                // Update turn
                if (newData.current_turn !== undefined) {
                    currentTurn = newData.current_turn;
                }

                // Update opponent stats
                if (myPlayerNum === 1) {
                    opponentStats.hp = newData.player2_health;
                    opponentStats.life = newData.player2_life;
                    opponentStats.trophies = newData.player2_trophies;
                } else {
                    opponentStats.hp = newData.player1_health;
                    opponentStats.life = newData.player1_life;
                    opponentStats.trophies = newData.player1_trophies;
                }

                // Check if battle ended
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