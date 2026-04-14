import { createClient } from '@supabase/supabase-js';

const EXTERNAL_SUPABASE_URL = 'https://ugdqkdjixmlnuzqaojbm.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnZHFrZGppeG1sbnV6cWFvamJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDgzNDIsImV4cCI6MjA5MTcyNDM0Mn0.uBW2HaGIYkipfkZgEYwTXZ4vkxvkstFbA3YnXw_oGZk';

export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);
