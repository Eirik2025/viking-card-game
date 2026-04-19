// Initialize Supabase client - replace with your credentials
const SUPABASE_URL = 'https://xuqpjnqxcvshbmjjdfpk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1cXBqbnF4Y3ZzaGJtampkZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MzgxODUsImV4cCI6MjA5MjIxNDE4NX0.36k-pdTOsJvlZp7zZYodLdUPUJTBtyVKNDq4Bq0AQgU';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getCurrentUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

async function signOut() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

function calculateExpRequirement(level, prestige = 0) {
    return Math.floor(100 * Math.pow(level, 1.5) * (1 + prestige * 0.5));
}

async function uploadAvatar(file) {
    const user = await getCurrentUser();
    if (!user) return null;
    
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;
    
    const { error: uploadError } = await supabaseClient.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
    
    if (uploadError) {
        console.error(uploadError);
        return null;
    }
    
    const { data } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);
    const avatarUrl = data.publicUrl + '?t=' + Date.now(); // bust cache
    
    await supabaseClient.from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);
    
    return avatarUrl;
}

export { supabaseClient as supabase, getCurrentUser, signOut, calculateExpRequirement, uploadAvatar };