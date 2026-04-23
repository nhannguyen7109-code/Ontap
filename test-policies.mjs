import { createClient } from '@supabase/supabase-js';
const supabase = createClient("https://qurretofxznnffaknxwf.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnJldG9meHpubmZmYWtueHdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgyMjAzOSwiZXhwIjoyMDkyMzk4MDM5fQ.bmxojqOR3K_zE8aNXzQHZVo_gKzsmQL3bSYhIwKVX24");

async function check() {
  const { data, error } = await supabase.rpc('query_policies').catch(e => ({error: e}));
  console.log("Policies using service role", data, error);
}
check();
