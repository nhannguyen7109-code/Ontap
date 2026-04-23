import { createClient } from '@supabase/supabase-js';
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnJldG9meHpubmZmYWtueHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MjIwMzksImV4cCI6MjA5MjM5ODAzOX0.IW_JyuVKDRbBWk3t076bzZgmrdR7sFxWot9XzWAQbKk";
const supabase = createClient("https://qurretofxznnffaknxwf.supabase.co", anonKey);

async function test() {
  console.log("---- Testing with Anon Key ----");

  // 1. Try to INSERT
  const insertMock = { id: crypto.randomUUID(), student_name: "MockStudent", class_name: "3A", grade: "3", subject: "Tin học", score: 1, total_questions: 2 };
  const { data: insData, error: insError } = await supabase.from('quiz_history').insert([insertMock]).select();
  console.log("INSERT select:", insData, insError);

  if (!insError) {
    const newId = insData[0]?.id;
    // 2. Try to SELECT
    const { data: selData, error: selError } = await supabase.from('quiz_history').select('*').eq('id', newId);
    console.log("SELECT returned:", selData, selError);

    // 3. Try to DELETE (without select)
    const { data: delData, error: delError, count } = await supabase.from('quiz_history').delete({ count: 'exact' }).eq('id', newId);
    console.log("DELETE (no select) returned:", delData, delError, "Count:", count);
  }
}
test();
