import { createClient } from "@supabase/supabase-js";

// These are safe to ship in client code: the publishable key only allows the
// access your Row Level Security policies permit (each user sees only their own
// rows). It is not a secret.
const SUPABASE_URL = "https://gvwcrqtiauvfcwqflida.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Vg7k1TYtEh9CLeKrGRk3hA_Io2pAxUj";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
