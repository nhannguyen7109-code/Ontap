import { createClient } from '@supabase/supabase-js';
const supabase = createClient("https://qurretofxznnffaknxwf.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnJldG9meHpubmZmYWtueHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MjIwMzksImV4cCI6MjA5MjM5ODAzOX0.IW_JyuVKDRbBWk3t076bzZgmrdR7sFxWot9XzWAQbKk");
async function run() {
  const { data, error } = await supabase.from('quiz_history').select('*').limit(3);
  console.log(data);
}
run();
