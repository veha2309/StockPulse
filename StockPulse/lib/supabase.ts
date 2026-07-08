import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Use the service role key on the server to bypass RLS, fallback to anon key on the client
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase environment variables. API calls will fail.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export function safeUser(u: any) {
  const rawTokens = u.eTokens ?? u.etokens ?? u.e_tokens ?? 0;
  return { 
    name: u.name, 
    email: u.email, 
    eTokens: Number(rawTokens) || 0, 
    portfolio: u.portfolio || [], 
    options: u.options || [] 
  };
}
