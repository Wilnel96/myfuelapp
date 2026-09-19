import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const getDriverToken = (): string | null =>
  typeof window !== 'undefined' ? window.localStorage.getItem('driverToken') : null;

const withDriverToken: typeof fetch = (input, init = {}) => {
  const headers = new Headers((init as RequestInit).headers as HeadersInit | undefined);
  const token = getDriverToken();
  if (token) headers.set('x-driver-token', token);
  return fetch(input as RequestInfo, { ...(init as RequestInit), headers });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'myfuelapp-auth',
    flowType: 'implicit'
  },
  global: {
    fetch: withDriverToken
  }
});
