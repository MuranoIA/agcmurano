import { createClient } from '@supabase/supabase-js';

const EXTERNAL_SUPABASE_URL = 'https://jjvbmqycgjgkwidgcmif.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqdmJtcXljZ2pna3dpZGdjbWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTU0NDksImV4cCI6MjA5NTAzMTQ0OX0.MAyVoGm8DX-vc-cMhwjpeB9MP5oWbotX8NBz7OiLlbk';

export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY);
