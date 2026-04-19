import { supabase, getCurrentUser, signOut } from './supabase-client.js';

window.signOut = signOut;
window.applyToKingdom = applyToKingdom;
window.closeModal = closeModal;

const ROLES = {
    JARL: { rank: 1, badge: 'role-jarl' },
    KARL: { rank: 2, badge: 'role-karl' },
    COMMANDER: { rank: 3, badge: 'role-commander' },
    THRALL: { rank: 4, badge: 'role-thrall' }
};

async function loadKingdoms() {
    const { data: kingdoms } = await supabase
        .from('kingdoms')
        .select('*, kingdom_members(count)')
        .order('total_xp', { ascending: false });
    
    const list = document.getElementById('kingdoms-list');
    list.innerHTML = (kingdoms || []).map(k => `
        <div class="kingdom-item" data-id="${k.id}" onclick="showKingdom('${k.id}')">
            <div>
                <strong>[${k.tag}] ${k.name}</strong>
                <div>${k.kingdom_members[0].count} members</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); applyToKingdom('${k.id}')">Apply</button>
        </div>
    `).join('');
}

window.showKingdom = async function(kingdomId) {
    const { data: kingdom } = await supabase
        .from('kingdoms')
        .select('*, kingdom_members(*, profiles(username))')
        .eq('id', kingdomId)
        .single();
    
    if (!kingdom) return;
    
    document.getElementById('kingdom-name').textContent = kingdom.name;
    document.getElementById('kingdom-tag').textContent = `[${kingdom.tag}]`;
    document.getElementById('member-count').textContent = `${kingdom.kingdom_members.length}/50`;
    document.getElementById('kingdom-xp').textContent = kingdom.total_xp;
    
    const membersList = document.getElementById('members-list');
    membersList.innerHTML = kingdom.kingdom_members.map(m => `
        <div class="member-item">
            <span>${m.profiles.username}</span>
            <span class="role-badge ${ROLES[m.role]?.badge || 'role-thrall'}">${m.role}</span>
        </div>
    `).join('');
    
    document.getElementById('kingdom-detail').classList.remove('hidden');
    subscribeToChat(kingdomId);
};

async function applyToKingdom(kingdomId) {
    const user = await getCurrentUser();
    await supabase.from('kingdom_applications').insert({
        kingdom_id: kingdomId,
        user_id: user.id
    });
    alert('Application sent!');
}

function subscribeToChat(kingdomId) {
    supabase
        .channel(`kingdom:${kingdomId}`)
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'kingdom_messages', filter: `kingdom_id=eq.${kingdomId}` },
            (payload) => appendMessage(payload.new)
        )
        .subscribe();
}

function appendMessage(msg) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-message';
    div.innerHTML = `<strong>${msg.username}:</strong> ${msg.content}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('send-chat').addEventListener('click', async () => {
    const input = document.getElementById('chat-input');
    const user = await getCurrentUser();
    const kingdomId = document.querySelector('.kingdom-item.active')?.dataset.id;
    if (!input.value.trim() || !kingdomId) return;
    
    await supabase.from('kingdom_messages').insert({
        kingdom_id: kingdomId,
        user_id: user.id,
        username: user.user_metadata.username,
        content: input.value
    });
    input.value = '';
});

document.getElementById('create-kingdom-btn').addEventListener('click', () => {
    document.getElementById('create-modal').classList.remove('hidden');
});

document.getElementById('confirm-create').addEventListener('click', async () => {
    const user = await getCurrentUser();
    const name = document.getElementById('new-kingdom-name').value;
    const tag = document.getElementById('new-kingdom-tag').value;
    
    const { data, error } = await supabase.from('kingdoms').insert({
        name,
        tag,
        leader_id: user.id
    }).select().single();
    
    if (error) {
        alert(error.message);
        return;
    }
    
    await supabase.from('kingdom_members').insert({
        kingdom_id: data.id,
        user_id: user.id,
        role: 'JARL'
    });
    
    closeModal();
    loadKingdoms();
});

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

loadKingdoms();