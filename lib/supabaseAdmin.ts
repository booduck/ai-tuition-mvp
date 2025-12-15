import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side only. Never import this into client components.
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
