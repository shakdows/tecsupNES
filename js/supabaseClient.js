const SUPABASE_URL = "https://ryhjcocjdthlassaarvx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5aGpjb2NqZHRobGFzc2FhcnZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MzE0MzIsImV4cCI6MjEwNTMwNzQzMn0.wu59WVasMakPe-pDIoDjDGlbxXoDhONGBgL-Dn7YxaQ";

if (SUPABASE_URL.includes("TU-PROYECTO")) {
  console.warn(
    "[N.E.S.] Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en js/supabaseClient.js"
  );
}


const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 5 } },
});
