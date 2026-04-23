import { createClient } from '@supabase/supabase-js';
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnJldG9meHpubmZmYWtueHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MjIwMzksImV4cCI6MjA5MjM5ODAzOX0.IW_JyuVKDRbBWk3t076bzZgmrdR7sFxWot9XzWAQbKk";
const supabase = createClient("https://qurretofxznnffaknxwf.supabase.co", anonKey);

async function test() {
  const insertMock = { student_name: "MockStudent2", class_name: "3A", grade: "3", subject: "Tin học", score: 1, total_questions: 2 };
  const { data: insData, error: insError } = await supabase.from('quiz_history').insert([insertMock]).select();
  console.log("INSERTED:", insData, insError);
  if(insData) {
    const newId = insData[0]?.id;
    const { data: delData, error: delError } = await supabase.from('quiz_history').delete().eq('id', newId).select();
    console.log("DELETE+SELECT returned:", delData, delError);
  }
}
test();
