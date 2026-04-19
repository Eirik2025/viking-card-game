import { supabase, getCurrentUser, signOut } from './supabase-client.js';

window.signOut = signOut;
window.createPost = createPost;
window.closeModal = closeModal;

async function checkAdmin() {
    const user = await getCurrentUser();
    if (!user) return;
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    
    if (profile?.role === 'admin') {
        document.getElementById('admin-panel').classList.remove('hidden');
    }
}

async function loadNews(category = 'all') {
    let query = supabase
        .from('news')
        .select('*')
        .eq('published', true)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
    
    if (category !== 'all') query = query.eq('category', category);
    
    const { data: posts } = await query;
    
    const container = document.getElementById('news-feed');
    container.innerHTML = (posts || []).map(post => `
        <div class="news-item ${post.pinned ? 'pinned' : ''}">
            ${post.pinned ? '<span class="pin-icon">📌</span>' : ''}
            <span class="news-category cat-${post.category}">${post.category}</span>
            <h3 class="news-title">${post.title}</h3>
            <div class="news-meta">Posted by ${post.author || 'Admin'} • ${new Date(post.created_at).toLocaleDateString()}</div>
            <div class="news-content">${post.content}</div>
        </div>
    `).join('');
}

async function createPost() {
    const user = await getCurrentUser();
    await supabase.from('news').insert({
        title: document.getElementById('post-title').value,
        content: document.getElementById('post-content').value,
        category: document.getElementById('post-category').value,
        author_id: user.id,
        pinned: document.getElementById('pin-post').checked,
        published: document.getElementById('publish-post').checked
    });
    
    document.getElementById('post-title').value = '';
    document.getElementById('post-content').value = '';
    loadNews();
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        loadNews(e.target.dataset.filter);
    });
});

checkAdmin();
loadNews();