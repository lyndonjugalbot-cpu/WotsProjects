const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!supabaseUrl || !supabaseAnonKey || !apiBaseUrl) {
  throw new Error(
    "Missing required VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_API_BASE_URL — copy .env.local.example to .env.local and fill it in."
  );
}

// The Supabase anon key is safe to embed in a compiled client — Row Level
// Security on the backend is what actually authorizes access, exactly as
// it is in the web app's own client bundle (see apps/web/src/lib/api/auth.ts
// for the server side of this same design). Never add a service-role key
// here or anywhere else in this app.
export const config = {
  supabaseUrl,
  supabaseAnonKey,
  apiBaseUrl,
} as const;
