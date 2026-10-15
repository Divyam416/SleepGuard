import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️  Supabase credentials not found. Please create a .env file from .env.example')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
