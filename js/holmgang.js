import { supabase, getCurrentUser, signOut } from './supabase-client.js';

window.signOut = signOut;
window.startBattle = startBattle;
window.declineMatch = declineMatch;

let currentDeck = [];
const ENTRY_FEE = 500;

async function loadCollection() {
    const user = await getCurrentUser();
    const { data: cards } = await supabase
        .from('user_cards')
        .select('card_id, cards(*)')
        .eq('user_id', user.id);
    
    const deckContainer = document.getElementById('deck-slots');
    deckContainer.innerHTML = '';
    
    for (let i = 0; i < 20; i++) {
        const slot = document.createElement('div');
        slot.className = 'deck-slot';
        slot.dataset.index = i;
        
        if (currentDeck[i]) {
            slot.classList.add('filled');
            slot.textContent = currentDeck[i].name;
        } else {
            slot.textContent = '+';
        }
        
        slot.addEventListener('click', () => selectCard(i, cards || []));
        deckContainer.appendChild(slot);
    }
}

function selectCard(index, availableCards) {
    const cardName = prompt('Enter card name (or empty to clear):');
    if (!cardName) {
        currentDeck[index] = null;
    } else {
        const card = availableCards.find(c => c.cards.name.toLowerCase() === cardName.toLowerCase());
        if (card) currentDeck[index] = card.cards;
    }
    loadCollection();
}

async function enterArena() {
    const user = await getCurrentUser();
    const { data: profile } = await supabase
        .from('profiles')
        .select('gold')
        .eq('id', user.id)
        .single();
    
    if (!profile || profile.gold < ENTRY_FEE) {
        alert('Not enough gold!');
        return;
    }
    
    await supabase.rpc('deduct_gold', { user_id: user.id, amount: ENTRY_FEE });
    
    await supabase.from('arena_queue').insert({
        user_id: user.id,
        deck: currentDeck,
        entered_at: new Date()
    });
    
    document.getElementById('enter-arena').textContent = 'Searching...';
    listenForMatch();
}

function listenForMatch() {
    supabase
        .channel('arena')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'arena_matches' },
            (payload) => {
                document.getElementById('match-modal').classList.remove('hidden');
                document.getElementById('opponent-name').textContent = payload.new.opponent_name;
            }
        )
        .subscribe();
}

function startBattle() {
    window.location.href = 'battle.html';
}

function declineMatch() {
    document.getElementById('match-modal').classList.add('hidden');
}

document.getElementById('enter-arena').addEventListener('click', enterArena);
document.getElementById('save-deck').addEventListener('click', async () => {
    const user = await getCurrentUser();
    await supabase.from('user_decks').upsert({
        user_id: user.id,
        deck: currentDeck,
        updated_at: new Date()
    });
    alert('Deck saved!');
});

loadCollection();