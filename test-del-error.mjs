import { createClient } from '@supabase/supabase-js';
const supabase = createClient("https://qurretofxznnffaknxwf.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnJldG9meHpubmZmYWtueHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MjIwMzksImV4cCI6MjA5MjM5ODAzOX0.IW_JyuVKDRbBWk3t076bzZgmrdR7sFxWot9XzWAQbKk");

async function test() {
  const { data: rows } = await supabase.from('quiz_history').select('id').limit(1);
  if (rows && rows.length > 0) {
     console.log("Found row to delete:", rows[0].id);
     const { data, error, count } = await supabase.from('quiz_history').delete().eq('id', rows[0].id).select();
     console.log("Delete result:", { data, error, count });
  } else {
     console.log("No rows found");
  }
}
test();
