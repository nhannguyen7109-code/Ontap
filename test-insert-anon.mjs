import { createClient } from '@supabase/supabase-js';
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cnJldG9meHpubmZmYWtueHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MjIwMzksImV4cCI6MjA5MjM5ODAzOX0.IW_JyuVKDRbBWk3t076bzZgmrdR7sFxWot9XzWAQbKk";
const supabase = createClient("https://qurretofxznnffaknxwf.supabase.co", anonKey);

async function testInsert() {
  const insertMock = { student_name: "MockStudentTest", class_name: "3A", grade: "3", subject: "Tin học", score: 1, total_questions: 2, details: [] };
  console.log("Attempting to insert without select...");
  const { data: insData, error: insError } = await supabase.from('quiz_history').insert([insertMock]);
  console.log("INSERT select:", insData, insError);
}
testInsert();
