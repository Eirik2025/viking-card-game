import { supabase, getCurrentUser, signOut } from './supabase-client.js';

window.signOut = signOut;
window.searchPlayers = searchPlayers;
window.openChat = openChat;
window.sendPrivateMessage = sendPrivateMessage;
window.sendRequest = sendRequest;
window.handleRequest = handleRequest;
window.challengeFriend = challengeFriend;
window.removeFriend = removeFriend;

let currentChatFriend = null;
let currentTab = 'friends';

async function loadFriends() {
    const user = await getCurrentUser();
    const { data: friendships } = await supabase
        .from('friendships')
        .select('*, friend:profiles!friend_id(username, status, avatar_url, level)')
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });
    
    renderSidebarContent('friends', friendships);
}

async function loadRequests() {
    const user = await getCurrentUser();
    const { data: requests } = await supabase
        .from('friendships')
        .select('*, requester:profiles!user_id(username, avatar_url)')
        .eq('friend_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    
    renderSidebarContent('requests', requests);
    updateBadge(requests?.length || 0);
}

async function loadFindPlayers() {
    renderSidebarContent('find', []);
}

function renderSidebarContent(tab, items) {
    const container = document.getElementById('sidebar-content');
    container.innerHTML = '';
    
    // Update tab buttons
    document.querySelectorAll('.sidebar-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    
    if (tab === 'friends') {
        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:2rem;text-align:center;">
                    <div class="empty-icon" style="font-size:3rem;margin-bottom:1rem;">👥</div>
                    <h3 style="color:var(--text);margin-bottom:0.5rem;">No Friends Yet</h3>
                    <p style="color:var(--text-muted);font-size:0.9rem;">Click "Find Players" to meet warriors</p>
                </div>
            `;
            return;
        }
        
        const list = document.createElement('div');
        list.className = 'friend-list';
        
        items.forEach(f => {
            const item = document.createElement('div');
            item.className = 'friend-item';
            if (currentChatFriend === f.friend_id) item.classList.add('active');
            
            const statusClass = f.friend.status || 'offline';
            
            item.innerHTML = `
                <img src="${f.friend.avatar_url || 'https://placehold.co/40x40/1a1a2e/c9a227?text=' + (f.friend.username?.[0] || '?')}" 
                     class="friend-avatar" alt="">
                <div class="friend-info">
                    <div class="friend-name">${f.friend.username}</div>
                    <div class="friend-meta">
                        <span class="friend-status status-${statusClass}"></span>
                        ${statusClass} • Lvl ${f.friend.level || 1}
                    </div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                document.querySelectorAll('.friend-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                openChat(f.friend_id, f.friend.username, f.friend.avatar_url, f.friend.status);
            });
            
            list.appendChild(item);
        });
        
        container.appendChild(list);
        
    } else if (tab === 'requests') {
        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:2rem;text-align:center;">
                    <div class="empty-icon" style="font-size:3rem;margin-bottom:1rem;">📭</div>
                    <h3 style="color:var(--text);margin-bottom:0.5rem;">No Pending Requests</h3>
                    <p style="color:var(--text-muted);font-size:0.9rem;">Check back later for new requests</p>
                </div>
            `;
            updateBadge(0);
            return;
        }
        
        const list = document.createElement('div');
        list.className = 'request-list';
        
        items.forEach(r => {
            const item = document.createElement('div');
            item.className = 'request-item';
            item.id = `request-${r.id}`;
            
            item.innerHTML = `
                <img src="${r.requester.avatar_url || 'https://placehold.co/40x40/1a1a2e/c9a227?text=' + (r.requester.username?.[0] || '?')}" 
                     class="request-avatar" alt="">
                <div class="request-info">
                    <div class="request-name">${r.requester.username}</div>
                    <div class="friend-meta">Wants to be your friend</div>
                </div>
                <div class="request-actions">
                    <button class="btn btn-primary btn-sm" onclick="handleRequest('${r.id}', 'accepted', '${r.user_id}')">Accept</button>
                    <button class="btn btn-danger btn-sm" onclick="handleRequest('${r.id}', 'declined')">Decline</button>
                </div>
            `;
            
            list.appendChild(item);
        });
        
        container.appendChild(list);
        updateBadge(items.length);
        
    } else if (tab === 'find') {
        container.innerHTML = `
            <div class="find-players">
                <div class="search-box">
                    <input type="text" id="find-player" placeholder="Search warriors by name..." onkeypress="if(event.key==='Enter')searchPlayers()">
                    <button class="btn btn-primary" onclick="searchPlayers()">Search</button>
                </div>
                <div class="player-results" id="player-results">
                    <p style="color:var(--text-muted);text-align:center;padding:2rem;">Enter a username to find warriors</p>
                </div>
            </div>
        `;
    }
}

function updateBadge(count) {
    const badge = document.getElementById('request-count');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

async function searchPlayers() {
    const query = document.getElementById('find-player')?.value?.trim();
    const container = document.getElementById('player-results');
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Searching...</p>';
    
    if (!query) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Enter a name to search</p>';
        return;
    }
    
    const user = await getCurrentUser();
    
    // Get existing friends to exclude
    const { data: existingFriends } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', user.id);
    
    const friendIds = existingFriends?.map(f => f.friend_id) || [];
    
    const { data: players, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, status, level')
        .ilike('username', `%${query}%`)
        .neq('id', user.id)
        .not('id', 'in', `(${friendIds.join(',')})`)
        .limit(20);
    
    if (error) {
        container.innerHTML = `<p style="color:var(--accent);text-align:center;padding:2rem;">Error: ${error.message}</p>`;
        return;
    }
    
    if (!players || players.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No warriors found with that name</p>';
        return;
    }
    
    container.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-result-item';
        div.innerHTML = `
            <img src="${p.avatar_url || 'https://placehold.co/40x40/1a1a2e/c9a227?text=' + (p.username?.[0] || '?')}" 
                 class="friend-avatar" alt="">
            <div class="friend-info">
                <div class="friend-name">${p.username}</div>
                <div class="friend-meta">Level ${p.level || 1} • ${p.status || 'offline'}</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="sendRequest('${p.id}')">Add Friend</button>
        `;
        container.appendChild(div);
    });
}

async function sendRequest(friendId) {
    const user = await getCurrentUser();
    
    // Check for existing in BOTH directions
    const { data: existing } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);
    
    if (existing && existing.length > 0) {
        const row = existing[0];
        
        if (row.status === 'accepted') {
            alert('You are already friends!');
            return;
        }
        
        // We sent them request
        if (row.user_id === user.id) {
            alert('Request already sent - waiting for them to accept');
            return;
        }
        
        // They sent us request - auto accept!
        if (row.friend_id === user.id) {
            await supabase.from('friendships')
                .update({ status: 'accepted' })
                .eq('id', row.id);
            
            // Create reciprocal friendship record
            try {
                await supabase.from('friendships').insert({
                    user_id: user.id,
                    friend_id: friendId,
                    status: 'accepted'
                });
            } catch (e) {
                console.log('Reciprocal insert error (expected if exists):', e);
            }
            
            alert('Friend request accepted! You are now friends.');
            
            // Refresh current view
            if (currentTab === 'friends') loadFriends();
            else if (currentTab === 'requests') loadRequests();
            return;
        }
    }
    
    // Send new request
    const { error } = await supabase.from('friendships').insert({
        user_id: user.id,
        friend_id: friendId,
        status: 'pending'
    });
    
    if (error) {
        alert('Error: ' + error.message);
    } else {
        alert('Friend request sent!');
        document.getElementById('player-results').innerHTML = 
            '<p style="color:var(--success);text-align:center;padding:2rem;">✓ Request sent!</p>';
    }
}

async function handleRequest(id, status, requesterId) {
    const user = await getCurrentUser();
    
    if (status === 'accepted') {
        // Update their request to accepted
        const { error: updateError } = await supabase
            .from('friendships')
            .update({ status: 'accepted' })
            .eq('id', id);
        
        if (updateError) {
            console.error('Update error:', updateError);
            alert('Failed to accept request');
            return;
        }
        
        // Create our side of the friendship
        if (requesterId) {
            try {
                await supabase.from('friendships').insert({
                    user_id: user.id,
                    friend_id: requesterId,
                    status: 'accepted'
                });
            } catch (e) {
                console.log('Reciprocal insert error (expected if exists):', e);
            }
        }
        
        // Remove the request item from DOM immediately
        const requestEl = document.getElementById(`request-${id}`);
        if (requestEl) {
            requestEl.style.opacity = '0';
            requestEl.style.transform = 'translateX(-20px)';
            setTimeout(() => requestEl.remove(), 300);
        }
        
        // Reload requests to update count and refresh list
        setTimeout(async () => {
            await loadRequests();
            
            // If no more requests, the empty state will show
            // Switch to friends tab to show the new friend
            currentTab = 'friends';
            await loadFriends();
            
            // Update tab UI
            document.querySelectorAll('.sidebar-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.tab === 'friends');
            });
        }, 350);
        
    } else {
        // Decline - delete the request
        await supabase.from('friendships').delete().eq('id', id);
        
        // Remove from DOM immediately
        const requestEl = document.getElementById(`request-${id}`);
        if (requestEl) {
            requestEl.style.opacity = '0';
            requestEl.style.transform = 'translateX(20px)';
            setTimeout(() => requestEl.remove(), 300);
        }
        
        // Refresh after animation
        setTimeout(() => loadRequests(), 350);
    }
}

async function openChat(friendId, username, avatarUrl, status) {
    currentChatFriend = friendId;
    
    document.getElementById('friends-main').innerHTML = '';
    document.getElementById('chat-panel').classList.remove('hidden');
    
    document.getElementById('chat-with').textContent = username;
    document.getElementById('chat-avatar').src = avatarUrl || 'https://placehold.co/50x50/1a1a2e/c9a227?text=' + (username?.[0] || '?');
    document.getElementById('chat-status').textContent = status || 'offline';
    document.getElementById('chat-status').className = 'chat-friend-status status-' + (status || 'offline');
    
    const user = await getCurrentUser();
    
    const { data: messages } = await supabase
        .from('private_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
        .limit(50);
    
    const container = document.getElementById('private-messages');
    container.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;">No messages yet. Start the conversation!</div>';
    } else {
        messages.forEach(m => {
            const div = document.createElement('div');
            div.className = 'message-bubble ' + (m.sender_id === user.id ? 'message-sent' : 'message-received');
            div.textContent = m.content;
            container.appendChild(div);
        });
    }
    
    container.scrollTop = container.scrollHeight;
    
    supabase
        .channel(`chat:${friendId}`)
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `receiver_id=eq.${user.id}` },
            (payload) => {
                if (payload.new.sender_id === friendId) {
                    const div = document.createElement('div');
                    div.className = 'message-bubble message-received';
                    div.textContent = payload.new.content;
                    container.appendChild(div);
                    container.scrollTop = container.scrollHeight;
                }
            }
        )
        .subscribe();
}

async function sendPrivateMessage() {
    if (!currentChatFriend) return;
    
    const input = document.getElementById('private-input');
    const content = input.value.trim();
    if (!content) return;
    
    const user = await getCurrentUser();
    
    const { error } = await supabase.from('private_messages').insert({
        sender_id: user.id,
        receiver_id: currentChatFriend,
        content: content
    });
    
    if (error) {
        alert('Failed to send: ' + error.message);
        return;
    }
    
    const div = document.createElement('div');
    div.className = 'message-bubble message-sent';
    div.textContent = content;
    
    const container = document.getElementById('private-messages');
    
    if (container.children.length === 1 && container.children[0].style.textAlign === 'center') {
        container.innerHTML = '';
    }
    
    container.appendChild(div);
    input.value = '';
    container.scrollTop = container.scrollHeight;
}

function challengeFriend() {
    if (!currentChatFriend) return;
    window.location.href = `battle.html?opponent=${currentChatFriend}`;
}

async function removeFriend() {
    if (!currentChatFriend) return;
    
    if (!confirm('Remove this friend? This cannot be undone.')) return;
    
    const user = await getCurrentUser();
    
    await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${currentChatFriend}),and(user_id.eq.${currentChatFriend},friend_id.eq.${user.id})`);
    
    currentChatFriend = null;
    document.getElementById('chat-panel').classList.add('hidden');
    
    document.getElementById('friends-main').innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">👋</div>
            <h3>Friend Removed</h3>
            <p>The warrior bond has been severed.</p>
        </div>
    `;
    
    loadFriends();
}

// Tab switching
document.querySelectorAll('.sidebar-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        currentTab = tab;
        
        currentChatFriend = null;
        document.getElementById('chat-panel').classList.add('hidden');
        document.getElementById('friends-main').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👋</div>
                <h3>Select a Friend</h3>
                <p>Choose from your friends list to start chatting.</p>
            </div>
        `;
        
        if (tab === 'friends') loadFriends();
        else if (tab === 'requests') loadRequests();
        else if (tab === 'find') loadFindPlayers();
    });
});

// Initial load
loadFriends();