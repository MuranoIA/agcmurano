import { createClient } from '@supabase/supabase-js';

const EXTERNAL_SUPABASE_URL = 'https://izfqptzjpgfbptybomky.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6ZnFwdHpqcGdmYnB0eWJvbWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDkzOTUsImV4cCI6MjA5MzQyNTM5NX0.gRCm8NgKWrPCdOaionjXoYET_z59UZ0Ng9p8hS6qxig';

export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);
