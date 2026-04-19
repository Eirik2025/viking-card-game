import { supabase, getCurrentUser, signOut } from './supabase-client.js';

window.signOut = signOut;
window.closeCardModal = closeCardModal;
window.showCardDetail = showCardDetail;

let allCards = [];

async function loadCollection() {
    const user = await getCurrentUser();
    if (!user) return;

    const { data: userCards } = await supabase
        .from('user_cards')
        .select('quantity, cards(*)')
        .eq('user_id', user.id);

    allCards = userCards || [];
    
    document.getElementById('card-count').textContent = `${allCards.reduce((sum, c) => sum + c.quantity, 0)} cards`;
    document.getElementById('unique-count').textContent = `${allCards.length} unique`;

    renderCards();
}

function renderCards(typeFilter = 'all', rarityFilter = 'all') {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '';

    const filtered = allCards.filter(uc => {
        const c = uc.cards;
        const typeMatch = typeFilter === 'all' || c.type === typeFilter;
        const rarityMatch = rarityFilter === 'all' || c.rarity === rarityFilter;
        return typeMatch && rarityMatch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="loading">No cards found</div>';
        return;
    }

    filtered.forEach(uc => {
        const c = uc.cards;
        const div = document.createElement('div');
        div.className = `card-item ${c.rarity}`;
        div.onclick = () => showCardDetail(uc);
        div.innerHTML = `
            <div class="card-image">${c.icon || '🃏'}</div>
            <div class="card-info">
                <div class="card-name">${c.name}</div>
                <div class="card-meta">
                    <span>${c.type}</span>
                    <span>×${uc.quantity}</span>
                </div>
            </div>
        `;
        grid.appendChild(div);
    });
}

window.showCardDetail = function(userCard) {
    const c = userCard.cards;
    document.getElementById('modal-name').textContent = c.name;
    document.getElementById('modal-rarity').textContent = c.rarity;
    document.getElementById('modal-rarity').className = `rarity-badge ${c.rarity}`;
    document.getElementById('modal-image').textContent = c.icon || '🃏';
    document.getElementById('modal-lore').textContent = c.lore || 'No lore available.';
    
    const statsDiv = document.getElementById('modal-stats');
    statsDiv.innerHTML = '';
    const stats = { Attack: c.attack, Defense: c.defense, Cost: c.cost };
    for (const [key, val] of Object.entries(stats)) {
        if (val !== null && val !== undefined) {
            statsDiv.innerHTML += `
                <div class="stat-box">
                    <span class="stat-label">${key}</span>
                    <span class="stat-value">${val}</span>
                </div>
            `;
        }
    }
    
    document.getElementById('card-modal').classList.remove('hidden');
};

function closeCardModal() {
    document.getElementById('card-modal').classList.add('hidden');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const rarity = document.querySelector('.rarity-btn.active').dataset.rarity;
        renderCards(e.target.dataset.filter, rarity);
    });
});

document.querySelectorAll('.rarity-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.rarity-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const type = document.querySelector('.filter-btn.active').dataset.filter;
        renderCards(type, e.target.dataset.rarity);
    });
});

loadCollection();