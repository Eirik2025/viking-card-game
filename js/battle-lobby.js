import { supabase, getCurrentUser, signOut } from './supabase-client.js';

window.signOut = signOut;
window.selectStyle = selectStyle;
// Match HTML onclick casing exactly:
window.BackToStyles = backToStyles;
window.HostConfiguredBattle = hostConfiguredBattle;
window.CopyCode = copyCode;
window.CancelBattle = cancelBattle;
window.JoinBattle = joinBattle;

let selectedConfig = {
    style: 'klandestine',
    useHp: true,
    useCoins: true,
    useDice: true,
    hpCount: 14,
    hpValue: 1,
    vigorColors: [],
    manaColors: [],
    typeColors: [],
    useLife: false,
    startLife: 8000,
    lifeIncrement: 1000,
    useTrophies: false,
    trophyCount: 6
};

// Color Presets
const vigorColors = [
    '#e74c3c', '#f39c12', '#f1c40f', '#27ae60', '#2980b9', 
    '#8e44ad', '#2c3e50', '#ecf0f1', '#95a5a6',
    '#d35400', '#c0392b', '#16a085', '#2ecc71', '#3498db'
];

const manaColors = ['#e74c3c', '#f39c12', '#f1c40f', '#27ae60', '#2980b9'];

// Generate 18 Type Colors
const typeColors = [];
for (let i = 0; i < 18; i++) {
    typeColors.push(`hsl(${i * 20}, 70%, 50%)`);
}

function selectStyle(style) {
    selectedConfig.style = style;
    
    // Update UI Selection
    document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    // Reset Config
    resetConfig();
    
    // Show Config Panel
    document.getElementById('config-panel').classList.remove('hidden');
    document.getElementById('join-section').classList.add('hidden');
    
    // Setup Config Based on Style
    setupConfigForStyle(style);
}

function resetConfig() {
    selectedConfig = {
        style: null,
        useHp: false,
        useCoins: false,
        useDice: false,
        hpCount: 20,
        hpValue: 20,
        vigorColors: [],
        manaColors: [],
        typeColors: [],
        useLife: false,
        startLife: 8000,
        lifeIncrement: 1000,
        useTrophies: false,
        trophyCount: 6
    };
}

function setupConfigForStyle(style) {
    // Hide all sections first - MATCHING HTML IDs EXACTLY:
    // HTML has: vigor-Section, Mana-Section, Type-Section
    // Note: There's no "life-section" in the HTML! Life settings are in a generic config-section
    
    const vigorSection = document.getElementById('vigor-Section');
    const manaSection = document.getElementById('Mana-Section');
    const typeSection = document.getElementById('Type-Section');
    
    if (vigorSection) vigorSection.classList.add('hidden');
    if (manaSection) manaSection.classList.add('hidden');
    if (typeSection) typeSection.classList.add('hidden');
    
    // Setup based on style
    switch(style) {
        case 'klandestine':
            selectedConfig.useHp = true;
            selectedConfig.useCoins = true;
            selectedConfig.useDice = true;
            selectedConfig.hpCount = 14;
            selectedConfig.hpValue = 1;
            selectedConfig.vigorColors = [];
            document.getElementById('use-hp').checked = true;
            document.getElementById('use-coins').checked = true;
            document.getElementById('use-dice').checked = true;
            if (vigorSection) vigorSection.classList.remove('hidden');
            break;
            
        case 'healthbox':
            selectedConfig.useHp = true;
            selectedConfig.useCoins = false;
            selectedConfig.useDice = true;
            selectedConfig.hpCount = 5;
            selectedConfig.hpValue = 20;
            selectedConfig.manaColors = [];
            document.getElementById('use-hp').checked = true;
            document.getElementById('use-coins').checked = false;
            document.getElementById('use-dice').checked = true;
            if (manaSection) manaSection.classList.remove('hidden');
            break;
            
        case 'award':
            selectedConfig.useHp = false;
            selectedConfig.useCoins = true;
            selectedConfig.useDice = false;
            selectedConfig.useTrophies = true;
            selectedConfig.trophyCount = 6;
            selectedConfig.typeColors = [];
            document.getElementById('use-hp').checked = false;
            document.getElementById('use-coins').checked = true;
            document.getElementById('use-dice').checked = false;
            if (typeSection) typeSection.classList.remove('hidden');
            break;
            
        case 'lifepoints':
            selectedConfig.useLife = true;
            selectedConfig.startLife = 8000;
            selectedConfig.lifeIncrement = 1000;
            document.getElementById('use-hp').checked = false;
            break;
            
        case 'custom':
            selectedConfig.useHp = true;
            selectedConfig.useCoins = true;
            selectedConfig.useDice = true;
            selectedConfig.useTrophies = true;
            selectedConfig.hpCount = 20;
            selectedConfig.hpValue = 20;
            selectedConfig.startLife = 8000;
            selectedConfig.lifeIncrement = 1000;
            selectedConfig.trophyCount = 6;
            document.getElementById('use-hp').checked = true;
            document.getElementById('use-coins').checked = true;
            document.getElementById('use-dice').checked = true;
            if (vigorSection) vigorSection.classList.remove('hidden');
            if (manaSection) manaSection.classList.remove('hidden');
            if (typeSection) typeSection.classList.remove('hidden');
            break;
    }
    
    // Update UI Values - MATCHING HTML IDs EXACTLY
    document.getElementById('hp-count').value = selectedConfig.hpCount;
    const hpValueEl = document.getElementById('HP-Value');
    if (hpValueEl) hpValueEl.value = selectedConfig.hpValue;
    
    document.getElementById('start-life').value = selectedConfig.startLife;
    const lifeIncEl = document.getElementById('Life-Increment');
    if (lifeIncEl) lifeIncEl.value = selectedConfig.lifeIncrement;
    
    renderColorGrids();
}

function renderColorGrids() {
    // Vigor Colors (14) - HTML has id="Vigor-colors"
    const vigorContainer = document.getElementById('Vigor-colors');
    if (vigorContainer) {
        vigorContainer.innerHTML = '';
        vigorColors.forEach((color, index) => {
            const div = document.createElement('div');
            div.className = 'color-option';
            div.style.backgroundColor = color;
            div.dataset.index = index;
            if (selectedConfig.vigorColors.includes(index)) {
                div.classList.add('selected');
            }
            div.addEventListener('click', () => toggleVigorColor(index));
            vigorContainer.appendChild(div);
        });
    }
    
    // Mana Colors (5) - HTML has id="Mana-colors"
    const manaContainer = document.getElementById('Mana-colors');
    if (manaContainer) {
        manaContainer.innerHTML = '';
        manaColors.forEach((color, index) => {
            const div = document.createElement('div');
            div.className = 'color-option';
            div.style.backgroundColor = color;
            div.dataset.index = index;
            if (selectedConfig.manaColors.includes(index)) {
                div.classList.add('selected');
            }
            div.addEventListener('click', () => toggleManaColor(index));
            manaContainer.appendChild(div);
        });
    }
    
    // Type Colors (18) - HTML has id="Type-colors"
    const typeContainer = document.getElementById('Type-colors');
    if (typeContainer) {
        typeContainer.innerHTML = '';
        typeColors.forEach((color, index) => {
            const div = document.createElement('div');
            div.className = 'color-option';
            div.style.backgroundColor = color;
            div.dataset.index = index;
            if (selectedConfig.typeColors.includes(index)) {
                div.classList.add('selected');
            }
            div.addEventListener('click', () => toggleTypeColor(index));
            typeContainer.appendChild(div);
        });
    }
}

function toggleVigorColor(index) {
    const idx = selectedConfig.vigorColors.indexOf(index);
    if (idx > -1) {
        selectedConfig.vigorColors.splice(idx, 1);
    } else {
        selectedConfig.vigorColors.push(index);
    }
    renderColorGrids();
}

function toggleManaColor(index) {
    const idx = selectedConfig.manaColors.indexOf(index);
    if (idx > -1) {
        selectedConfig.manaColors.splice(idx, 1);
    } else {
        selectedConfig.manaColors.push(index);
    }
    renderColorGrids();
}

function toggleTypeColor(index) {
    const idx = selectedConfig.typeColors.indexOf(index);
    if (idx > -1) {
        selectedConfig.typeColors.splice(idx, 1);
    } else {
        selectedConfig.typeColors.push(index);
    }
    renderColorGrids();
}

function backToStyles() {
    document.getElementById('config-panel').classList.add('hidden');
    document.getElementById('join-section').classList.remove('hidden');
    document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
    selectedConfig.style = null;
}

function generateBattleCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function hostConfiguredBattle() {
    const user = await getCurrentUser();
    if (!user) {
        alert('Please log in first');
        return;
    }
    
    const code = generateBattleCode();
    
    const { data, error } = await supabase
        .from('battles')
        .insert({
            host_id: user.id,
            battle_code: code,
            config: selectedConfig,
            status: 'waiting',
            player1_id: user.id,
            player1_health: selectedConfig.useHp ? selectedConfig.hpValue * selectedConfig.hpCount : null,
            player1_life: selectedConfig.useLife ? selectedConfig.startLife : null,
            player1_trophies: selectedConfig.useTrophies ? 0 : null,
            player2_health: selectedConfig.useHp ? selectedConfig.hpValue * selectedConfig.hpCount : null,
            player2_life: selectedConfig.useLife ? selectedConfig.startLife : null,
            player2_trophies: selectedConfig.useTrophies ? 0 : null
        })
        .select()
        .single();
    
    if (error) {
        console.error('Battle creation error:', error);
        alert('Failed to create battle: ' + error.message);
        return;
    }
    
    document.getElementById('config-panel').classList.add('hidden');
    document.getElementById('code-display').classList.remove('hidden');
    document.getElementById('battle-code').textContent = code;
    
    supabase
        .channel(`battle:${code}`)
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'battles', filter: `id=eq.${data.id}` },
            (payload) => {
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

async function cancelBattle() {
    const code = document.getElementById('battle-code').textContent;
    
    const { error } = await supabase
        .from('battles')
        .update({ status: 'cancelled' })
        .eq('battle_code', code);
    
    if (error) {
        console.error('Cancel error:', error);
    }
    
    document.getElementById('code-display').classList.add('hidden');
    document.getElementById('join-section').classList.remove('hidden');
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
    
    const { data: battle, error } = await supabase
        .from('battles')
        .select('*')
        .eq('battle_code', code)
        .eq('status', 'waiting')
        .single();
    
    if (error || !battle) {
        alert('Battle not found or already started');
        return;
    }
    
    if (battle.host_id === user.id) {
        alert('Cannot join your own battle');
        return;
    }
    
    await supabase
        .from('battles')
        .update({
            guest_id: user.id,
            player2_id: user.id,
            status: 'ready'
        })
        .eq('id', battle.id);
    
    window.location.href = `battle.html?battle=${battle.id}&code=${code}&guest=1`;
}