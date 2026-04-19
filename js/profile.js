import { supabase, getCurrentUser, signOut, uploadAvatar, calculateExpRequirement } from './supabase-client.js';

window.signOut = signOut;

async function loadProfile() {
    const user = await getCurrentUser();
    if (!user) return;

    // Main profile data
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) return;

    // Name & Role
    document.getElementById('profile-name').textContent = profile.username;
    document.getElementById('profile-role').textContent = profile.role;

    // Avatar
    const avatarImg = document.getElementById('profile-avatar');
    if (profile.avatar_url) {
        avatarImg.src = profile.avatar_url;
    } else {
        avatarImg.src = 'https://placehold.co/150x150/1a1a2e/c9a227?text=' + (profile.username?.[0] || 'W');
    }

    // Combat Stats
    const expNeeded = calculateExpRequirement(profile.level, profile.prestige_level);
    const expProgress = Math.min(100, Math.floor((profile.experience / expNeeded) * 100));
    
    document.getElementById('combat-stats').innerHTML = `
        <div class="stat-box">
            <span class="stat-label">Level</span>
            <span class="stat-value">${profile.level}</span>
        </div>
        <div class="stat-box">
            <span class="stat-label">Prestige</span>
            <span class="stat-value">${profile.prestige_level}</span>
        </div>
        <div class="stat-box">
            <span class="stat-label">Total Wins</span>
            <span class="stat-value">${profile.total_wins}</span>
        </div>
        <div class="stat-box">
            <span class="stat-label">Gold</span>
            <span class="stat-value">${profile.gold}</span>
        </div>
    `;

    document.getElementById('exp-fill').style.width = `${expProgress}%`;
    document.getElementById('exp-text').textContent = `${profile.experience} / ${expNeeded} XP`;

    // Social Stats
    const { count: friendCount } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'accepted');

    document.getElementById('social-info').innerHTML = `
        <div class="info-row">
            <span class="info-label">Friends</span>
            <span class="info-value">${friendCount || 0}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Status</span>
            <span class="info-value">${profile.status}</span>
        </div>
    `;

    // Kingdom Info
    const { data: kingdomMember } = await supabase
        .from('kingdom_members')
        .select('role, kingdoms(name, tag, total_xp)')
        .eq('user_id', user.id)
        .maybeSingle();

    if (kingdomMember) {
        document.getElementById('kingdom-info').innerHTML = `
            <div class="info-row">
                <span class="info-label">Kingdom</span>
                <span class="info-value">[${kingdomMember.kingdoms.tag}] ${kingdomMember.kingdoms.name}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Rank</span>
                <span class="info-value">${kingdomMember.role}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Kingdom XP</span>
                <span class="info-value">${kingdomMember.kingdoms.total_xp}</span>
            </div>
        `;
    } else {
        document.getElementById('kingdom-info').innerHTML = `
            <div class="info-row">
                <span class="info-label">Kingdom</span>
                <span class="info-value">None</span>
            </div>
            <a href="kingdoms.html" class="btn btn-primary" style="margin-top:1rem;width:100%;text-align:center;">Find a Kingdom</a>
        `;
    }

    // Collection Summary
    const { count: uniqueCards } = await supabase
        .from('user_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

    const { data: cardTotals } = await supabase
        .from('user_cards')
        .select('quantity')
        .eq('user_id', user.id);

    const totalCards = (cardTotals || []).reduce((sum, c) => sum + (c.quantity || 0), 0);

    document.getElementById('collection-summary').innerHTML = `
        <div class="collection-stat">
            <span class="number">${uniqueCards || 0}</span>
            <span class="label">Unique Cards</span>
        </div>
        <div class="collection-stat">
            <span class="number">${totalCards}</span>
            <span class="label">Total Cards</span>
        </div>
        <div class="collection-stat">
            <span class="number">${totalCards > 0 ? Math.floor((uniqueCards / 200) * 100) : 0}%</span>
            <span class="label">Completion</span>
        </div>
    `;
}

// Avatar Upload
document.getElementById('avatar-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const newUrl = await uploadAvatar(file);
    if (newUrl) {
        document.getElementById('profile-avatar').src = newUrl;
        // Also update navbar avatar if visible
        const navAvatar = document.getElementById('nav-avatar');
        if (navAvatar) {
            navAvatar.src = newUrl;
            navAvatar.classList.remove('hidden');
        }
    }
});

loadProfile();