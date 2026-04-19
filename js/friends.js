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
        .select('*, friend:profiles!friend_id(username, status)')
        .eq('user_id', user.id)
        .eq('status', 'accepted');
    
    const container = document.getElementById('tab-content');
    container.innerHTML = (friendships || []).map(f => `
        <div class="friend-item" onclick="openChat('${f.friend_id}', '${f.friend.username}')">
            <div>
                <span class="friend-status status-${f.friend.status}"></span>
                <span>${f.friend.username}</span>
            </div>
            <span class="status-text">${f.friend.status}</span>
        </div>
    `).join('');
}

async function loadRequests() {
    const user = await getCurrentUser();
    const { data: requests } = await supabase
        .from('friendships')
        .select('*, requester:profiles!user_id(username)')
        .eq('friend_id', user.id)
        .eq('status', 'pending');
    
    const container = document.getElementById('tab-content');
    container.innerHTML = (requests || []).map(r => `
        <div class="request-item">
            <span>${r.requester.username}</span>
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
        .select('id, username')
        .ilike('username', `%${query}%`)
        .neq('id', user.id)
        .limit(10);
    
    const container = document.getElementById('tab-content');
    container.innerHTML = (players || []).map(p => `
        <div class="friend-item">
            <span>${p.username}</span>
            <button class="btn btn-secondary" onclick="sendRequest('${p.id}')">Add Friend</button>
        </div>
    `).join('');
}

async function sendRequest(friendId) {
    const user = await getCurrentUser();
    await supabase.from('friendships').insert({
        user_id: user.id,
        friend_id: friendId,
        status: 'pending'
    });
    alert('Friend request sent!');
}

async function handleRequest(id, status) {
    await supabase.from('friendships').update({ status }).eq('id', id);
    loadRequests();
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