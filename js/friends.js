import { supabase, getCurrentUser, signOut } from './supabase-client.js';

window.signOut = signOut;
window.searchPlayers = searchPlayers;
window.openChat = openChat;
window.sendPrivateMessage = sendPrivateMessage;
window.sendRequest = sendRequest;
window.handleRequest = handleRequest;
window.challengeFriend = challengeFriend;

let currentChatFriend = null;

async function loadFriends() {
    const user = await getCurrentUser();
    const { data: friendships } = await supabase
        .from('friendships')
        .select('*, friend:profiles!friend_id(username, status, avatar_url)')
        .eq('user_id', user.id)
        .eq('status', 'accepted');
    
    const container = document.getElementById('tab-content');
    container.innerHTML = (friendships || []).map(f => `
        <div class="friend-item" onclick="openChat('${f.friend_id}', '${f.friend.username}')">
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <img src="${f.friend.avatar_url || 'https://placehold.co/32x32/1a1a2e/c9a227?text=' + (f.friend.username?.[0] || '?')}" 
                     style="width:32px;height:32px;border-radius:50%;border:1px solid var(--primary);">
                <div>
                    <div style="font-weight:bold;">${f.friend.username}</div>
                    <div style="font-size:0.8rem;color:var(--text-muted);">
                        <span class="friend-status status-${f.friend.status}"></span>${f.friend.status}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadRequests() {
    const user = await getCurrentUser();
    const { data: requests } = await supabase
        .from('friendships')
        .select('*, requester:profiles!user_id(username, avatar_url)')
        .eq('friend_id', user.id)
        .eq('status', 'pending');
    
    const container = document.getElementById('tab-content');
    container.innerHTML = (requests || []).map(r => `
        <div class="request-item">
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <img src="${r.requester.avatar_url || 'https://placehold.co/32x32/1a1a2e/c9a227?text=' + (r.requester.username?.[0] || '?')}" 
                     style="width:32px;height:32px;border-radius:50%;border:1px solid var(--primary);">
                <span>${r.requester.username}</span>
            </div>
            <div class="request-actions">
                <button class="btn btn-primary" onclick="handleRequest('${r.id}', 'accepted')">Accept</button>
                <button class="btn btn-danger" onclick="handleRequest('${r.id}', 'declined')">Decline</button>
            </div>
        </div>
    `).join('');
}

async function searchPlayers() {
    const query = document.getElementById('find-player').value;
    const user = await getCurrentUser();
    
    const { data: players } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${query}%`)
        .neq('id', user.id)
        .limit(10);
    
    const container = document.getElementById('tab-content');
    container.innerHTML = (players || []).map(p => `
        <div class="friend-item">
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <img src="${p.avatar_url || 'https://placehold.co/32x32/1a1a2e/c9a227?text=' + (p.username?.[0] || '?')}" 
                     style="width:32px;height:32px;border-radius:50%;border:1px solid var(--primary);">
                <span>${p.username}</span>
            </div>
            <button class="btn btn-secondary" onclick="sendRequest('${p.id}')">Add Friend</button>
        </div>
    `).join('');
}

async function sendRequest(friendId) {
    const user = await getCurrentUser();
    
    // Check for existing friendship in EITHER direction
    const { data: existing } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);
    
    if (existing && existing.length > 0) {
        const row = existing[0];
        
        if (row.status === 'accepted') {
            alert('You are already friends with this player!');
            return;
        }
        
        // We sent them a request already
        if (row.user_id === user.id) {
            alert('Friend request already sent!');
            return;
        }
        
        // They sent us a request — auto-accept
        if (row.friend_id === user.id) {
            await supabase.from('friendships')
                .update({ status: 'accepted' })
                .eq('id', row.id);
            alert('Friend request accepted!');
            loadFriends();
            return;
        }
    }
    
    // Safe to insert
    const { error } = await supabase.from('friendships').insert({
        user_id: user.id,
        friend_id: friendId,
        status: 'pending'
    });
    
    if (error) {
        alert('Error: ' + error.message);
    } else {
        alert('Friend request sent!');
    }
}

async function handleRequest(id, status) {
    await supabase.from('friendships').update({ status }).eq('id', id);
    loadRequests();
    if (status === 'accepted') loadFriends();
}

async function openChat(friendId, username) {
    currentChatFriend = friendId;
    document.getElementById('chat-with').textContent = username;
    document.getElementById('chat-panel').classList.remove('hidden');
    
    const user = await getCurrentUser();
    const { data: messages } = await supabase
        .from('private_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
    
    const container = document.getElementById('private-messages');
    container.innerHTML = (messages || []).map(m => `
        <div class="message-bubble ${m.sender_id === user.id ? 'message-sent' : 'message-received'}">
            ${m.content}
        </div>
    `).join('');
    
    supabase
        .channel(`chat:${friendId}`)
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `receiver_id=eq.${user.id}` },
            (payload) => {
                const div = document.createElement('div');
                div.className = 'message-bubble message-received';
                div.textContent = payload.new.content;
                container.appendChild(div);
                container.scrollTop = container.scrollHeight;
            }
        )
        .subscribe();
}

async function sendPrivateMessage() {
    const input = document.getElementById('private-input');
    const user = await getCurrentUser();
    if (!input.value.trim() || !currentChatFriend) return;
    
    await supabase.from('private_messages').insert({
        sender_id: user.id,
        receiver_id: currentChatFriend,
        content: input.value
    });
    
    const container = document.getElementById('private-messages');
    const div = document.createElement('div');
    div.className = 'message-bubble message-sent';
    div.textContent = input.value;
    container.appendChild(div);
    input.value = '';
    container.scrollTop = container.scrollHeight;
}

function challengeFriend() {
    if (!currentChatFriend) return;
    window.location.href = `battle.html?opponent=${currentChatFriend}`;
}

document.querySelectorAll('.friends-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.friends-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        if (e.target.dataset.tab === 'friends') loadFriends();
        else if (e.target.dataset.tab === 'requests') loadRequests();
    });
});

loadFriends();