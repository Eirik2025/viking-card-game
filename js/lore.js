import { supabase } from './supabase-client.js';

window.searchLore = searchLore;
window.showLore = showLore;
window.closeLore = closeLore;

async function loadLore(category = 'all', search = '') {
    let query = supabase.from('card_lore').select('*');
    if (category !== 'all') query = query.eq('category', category);
    if (search) query = query.ilike('name', `%${search}%`);
    
    const { data } = await query.order('name');
    
    const container = document.getElementById('lore-grid');
    container.innerHTML = (data || []).map(item => `
        <div class="lore-card" onclick="showLore('${item.id}')">
            <div class="lore-card-image">${item.icon || '📜'}</div>
            <div class="lore-card-info">
                <div class="lore-card-title">${item.name}</div>
                <div class="lore-card-type">${item.category}</div>
            </div>
        </div>
    `).join('');
}

async function showLore(id) {
    const { data: item } = await supabase
        .from('card_lore')
        .select('*')
        .eq('id', id)
        .single();
    
    if (!item) return;
    
    document.getElementById('lore-title').textContent = item.name;
    document.getElementById('lore-image').textContent = item.icon || '📜';
    document.getElementById('lore-text').textContent = item.lore_text;
    
    const statsDiv = document.getElementById('lore-stats');
    statsDiv.innerHTML = '';
    if (item.stats) {
        statsDiv.innerHTML = Object.entries(item.stats)
            .map(([key, val]) => `<div><strong>${key}:</strong> ${val}</div>`)
            .join('');
    }
    
    document.getElementById('lore-modal').classList.remove('hidden');
}

function closeLore() {
    document.getElementById('lore-modal').classList.add('hidden');
}

function searchLore() {
    const query = document.getElementById('lore-search').value;
    const activeCat = document.querySelector('.lore-cat.active').dataset.cat;
    loadLore(activeCat, query);
}

document.querySelectorAll('.lore-cat').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.lore-cat').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        loadLore(e.target.dataset.cat);
    });
});

loadLore();