// Initialize Supabase client - replace with your credentials
const SUPABASE_URL = 'https://xuqpjnqxcvshbmjjdfpk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1cXBqbnF4Y3ZzaGJtampkZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MzgxODUsImV4cCI6MjA5MjIxNDE4NX0.36k-pdTOsJvlZp7zZYodLdUPUJTBtyVKNDq4Bq0AQgU';

// FIX: Use a distinct variable name to avoid clashing with the global 'supabase' UMD object
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getCurrentUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

async function signOut() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// EXP Compound Formula: EXP = base * (level ^ 1.5) * (1 + prestige * 0.5)
function calculateExpRequirement(level, prestige = 0) {
    return Math.floor(100 * Math.pow(level, 1.5) * (1 + prestige * 0.5));
}

export { supabaseClient as supabase, getCurrentUser, signOut, calculateExpRequirement };