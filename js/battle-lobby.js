import { supabase, getCurrentUser, signOut } from './supabase-client.js';

window.signOut = signOut;
window.selectStyle = selectStyle;
window.backToStyles = backToStyles;
window.hostConfiguredBattle = hostConfiguredBattle;
window.copyCode = copyCode;
window.cancelBattle = cancelBattle;
window.joinBattle = joinBattle;

let selectedStyle = null;
let currentBattleId = null;
let battleChannel = null;

const stylePresets = {
    viking: {
        useHealth: true,
        useLife: false,
        useTrophies: false,
        startValue: 20,
        incrementStep: 1,
        useDice: true,
        useCoin: true,
        useTimer: false,
        winCondition: 'zero'
    },
    mtg: {
        useHealth: false,
        useLife: true,
        useTrophies: false,
        startValue: 20,
        incrementStep: 1,
        useDice: true,
        useCoin: false,
        useTimer: true,
        winCondition: 'zero'
    },
    pokemon: {
        useHealth: false,
        useLife: false,
        useTrophies: true,
        startValue: 6,
        incrementStep: 1,
        useDice: false,
        useCoin: true,
        useTimer: false,
        winCondition: 'trophies'
    },
    custom: {
        useHealth: true,
        useLife: false,
        useTrophies: false,
        startValue: 20,
        incrementStep: 1,
        useDice: true,
        useCoin: true,
        useTimer: false,
        winCondition: 'zero'
    }
};

function selectStyle(style) {
    selectedStyle = style;
    
    // Visual selection
    document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    // Apply preset
    const preset = stylePresets[style];
    document.getElementById('use-health').checked = preset.useHealth;
    document.getElementById('use-life').checked = preset.useLife;
    document.getElementById('use-trophies').checked = preset.useTrophies;
    document.getElementById('start-value').value = preset.startValue;
    document.getElementById('increment-step').value = preset.incrementStep;
    document.getElementById('use-dice').checked = preset.useDice;
    document.getElementById('use-coin').checked = preset.useCoin;
    document.getElementById('use-timer').checked = preset.useTimer;
    document.querySelector(`input[name="win-cond"][value="${preset.winCondition}"]`).checked = true;
    
    // Show config
    document.getElementById('config-panel').classList.remove('hidden');
    document.getElementById('join-section').classList.add('hidden');
    
    // Scroll to config
    document.getElementById('config-panel').scrollIntoView({ behavior: 'smooth' });
}

function backToStyles() {
    document.getElementById('config-panel').classList.add('hidden');
    document.getElementById('join-section').classList.remove('hidden');
    document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
    selectedStyle = null;
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
    
    // Gather configuration
    const config = {
        style: selectedStyle,
        useHealth: document.getElementById('use-health').checked,
        useLife: document.getElementById('use-life').checked,
        useTrophies: document.getElementById('use-trophies').checked,
        startValue: parseInt(document.getElementById('start-value').value),
        incrementStep: parseInt(document.getElementById('increment-step').value),
        useDice: document.getElementById('use-dice').checked,
        useCoin: document.getElementById('use-coin').checked,
        useTimer: document.getElementById('use-timer').checked,
        winCondition: document.querySelector('input[name="win-cond"]:checked').value
    };
    
    const code = generateBattleCode();
    
    const { data, error } = await supabase
        .from('battles')
        .insert({
            host_id: user.id,
            battle_code: code,
            config: config,
            status: 'waiting',
            player1_id: user.id,
            player1_health: config.useHealth ? config.startValue : null,
            player1_life: config.useLife ? config.startValue : null,
            player1_trophies: config.useTrophies ? 0 : null,
            player2_health: config.useHealth ? config.startValue : null,
            player2_life: config.useLife ? config.startValue : null,
            player2_trophies: config.useTrophies ? 0 : null
        })
        .select()
        .single();
    
    if (error) {
        console.error('Battle creation error:', error);
        alert('Failed to create battle: ' + error.message);
        return;
    }
    
    currentBattleId = data.id;
    
    // Show code display
    document.getElementById('config-panel').classList.add('hidden');
    document.getElementById('code-display').classList.remove('hidden');
    document.getElementById('battle-code').textContent = code;
    
    // Listen for opponent
    battleChannel = supabase
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
        alert('Code copied!');
    });
}

async function cancelBattle() {
    if (!currentBattleId) return;
    
    await supabase.from('battles').delete().eq('id', currentBattleId);
    
    if (battleChannel) {
        supabase.removeChannel(battleChannel);
    }
    
    document.getElementById('code-display').classList.add('hidden');
    document.getElementById('join-section').classList.remove('hidden');
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
    
    // Join as guest
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