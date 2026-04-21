import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, BookOpen, Monitor, Cpu, PlusCircle, Shuffle, 
  CheckCircle, XCircle, Volume2, VolumeX, Trophy, User, LogOut,
  History as HistoryIcon, Award, BookText, ChevronLeft,
  Star, Rocket, Smile, Sparkles, Cloud
} from 'lucide-react';
import { motion } from 'motion/react';

import { LESSONS_DATA } from './lib/lessons_data';

// --- HỆ THỐNG ÂM THANH (Web Audio API) ---
const AudioEngine = {
  ctx: null as AudioContext | null,
  init: function() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  playTone: function(freq: number, type: OscillatorType, duration: number, vol = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  playHover: function() {
    this.playTone(800, 'sine', 0.1, 0.05);
  },
  playCorrect: function() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  },
  playWrong: function() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.setValueAtTime(100, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  },
  playCongrats: function() {
    if (!this.ctx) return;
    const freqs = [440, 554.37, 659.25, 880];
    freqs.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.3, 0.15), i * 150);
    });
  }
};

const isLessonInSemester = (lessonName: string, grade: string, subject: string, semester: 'HK1' | 'HK2') => {
  const ranges: any = {
    '3': {
      'Tin học': { HK1: [1, 7], HK2: [8, 15] },
      'Công nghệ': { HK1: [1, 6], HK2: [7, 9] },
    },
    '4': {
      'Tin học': { HK1: [1, 8], HK2: [9, 14] },
      'Công nghệ': { HK1: [1, 6], HK2: [6, 9] },
    },
    '5': {
      'Tin học': { HK1: [1, 8], HK2: [9, 15] },
      'Công nghệ': { HK1: [1, 6], HK2: [7, 9] },
    }
  };

  const range = ranges[grade]?.[subject]?.[semester];
  if (!range) return false;

  const match = lessonName.match(/Bài\s*(\d+)/i);
  if (match) {
    const num = parseInt(match[1]);
    return num >= range[0] && num <= range[1];
  }

  if (lessonName.toLowerCase().includes('ôn tập phần 1') || lessonName.toLowerCase().includes('ôn tập học kì 1')) return semester === 'HK1';
  if (lessonName.toLowerCase().includes('ôn tập phần 2') || lessonName.toLowerCase().includes('ôn tập học kì 2')) return semester === 'HK2';

  return false;
};

type OptionObject = {
  text: string;
  isCorrect: boolean;
  originalIndex: number;
};

type Question = {
  id: number;
  subject: string;
  grade: string;
  lesson?: string; // Optional for backward compatibility but good for new questions
  text: string;
  type?: 'multiple_choice' | 'short_answer';
  options?: string[];
  correctIndex?: number;
  shortAnswers?: string[];
  optionsObjects?: OptionObject[];
};

type Student = {
  name: string;
  className: string;
  grade: string;
};

type QuizHistory = {
  id: string;
  studentName: string;
  className: string;
  grade: string;
  subject: string;
  score: number;
  totalQuestions: number;
  date: string;
};

// --- DỮ LIỆU CÂU HỎI MẪU ---
const INITIAL_QUESTIONS: Question[] = [
  // Tin học
  { id: 1, subject: 'Tin học', grade: '3', lesson: 'Bài 1 Thông tin và quyết định', text: 'Chuột máy tính thường có mấy nút cơ bản?', options: ['1 nút', '2 nút (Trái, Phải)', '4 nút', 'Không có nút nào'], correctIndex: 1 },
  { id: 2, subject: 'Tin học', grade: '3', lesson: 'Bài 2 Xử lý thông tin', text: 'Đâu là bộ phận dùng để gõ chữ vào máy tính?', options: ['Màn hình', 'Chuột', 'Bàn phím', 'Thùng máy'], correctIndex: 2 },
  { id: 3, subject: 'Tin học', grade: '4', text: 'Thư mục trên máy tính dùng để làm gì?', options: ['Để nghe nhạc', 'Để chứa các tệp tin và thư mục khác', 'Để chơi game', 'Để diệt virus'], correctIndex: 1 },
  { id: 4, subject: 'Tin học', grade: '5', text: 'Phần mềm MS Word dùng để làm gì?', options: ['Soạn thảo văn bản', 'Vẽ tranh', 'Tính toán', 'Duyệt web'], correctIndex: 0 },
  // Công nghệ
  { id: 5, subject: 'Công nghệ', grade: '3', lesson: 'Bài 1 Tự nhiên và công nghệ', text: 'Vật nào sau đây sử dụng điện để hoạt động?', options: ['Cái kéo', 'Cái bát', 'Bóng đèn', 'Quyển vở'], correctIndex: 2 },
  { id: 6, subject: 'Công nghệ', grade: '4', text: 'Khi sử dụng điện, ta cần chú ý điều gì để đảm bảo an toàn?', options: ['Cắm điện khi tay ướt', 'Chơi đùa gần ổ cắm điện', 'Không chạm tay vào ổ cắm điện', 'Dùng kéo cắt dây điện'], correctIndex: 2 },
  { id: 7, subject: 'Công nghệ', grade: '5', text: 'Lắp ráp mô hình cần thực hiện theo bước nào trước tiên?', options: ['Quan sát hình mẫu', 'Lắp các bộ phận', 'Tháo rời', 'Chơi mô hình'], correctIndex: 0 },
  { id: 8, subject: 'Tin học', grade: '3', lesson: 'Bài 1 Thông tin và quyết định', text: 'Thiết bị nào dùng để hiển thị hình ảnh từ máy tính?', type: 'short_answer', shortAnswers: ['Màn hình', 'man hinh', 'màn hình'] },
  { id: 9, subject: 'Công nghệ', grade: '3', lesson: 'Bài 2 Sử dụng đèn học', text: 'Quạt điện dùng năng lượng gì để quay?', type: 'short_answer', shortAnswers: ['Điện', 'điện', 'dien'] },
];

// Hàm trộn mảng
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export default function App() {
  const [student, setStudent] = useState<Student | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginMode, setLoginMode] = useState<'student' | 'admin'>('student');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [activeTab, setActiveTab] = useState('select-subject'); // 'select-subject', 'select-lesson', 'quiz', 'admin', 'history', 'leaderboard'
  const [currentSubject, setCurrentSubject] = useState('Tin học');
  const [currentLesson, setCurrentLesson] = useState<string | null>(null);
  
  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('quiz_questions');
    return saved ? JSON.parse(saved) : INITIAL_QUESTIONS;
  });

  const [history, setHistory] = useState<QuizHistory[]>(() => {
    const saved = localStorage.getItem('quiz_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('quiz_questions', JSON.stringify(questions));
  }, [questions]);

  useEffect(() => {
    localStorage.setItem('quiz_history', JSON.stringify(history));
  }, [history]);

  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [answerStatus, setAnswerStatus] = useState<{index: number, isCorrect: boolean} | null>(null);
  
  // Trạng thái cho nhạc nền
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const bgmSrc = useMemo(() => {
    if (!student) return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3";
    switch (student.grade) {
      case '3': return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3";
      case '4': return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3";
      case '5': return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3";
      default: return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3";
    }
  }, [student?.grade]);

  // Form đăng nhập
  const [loginForm, setLoginForm] = useState({ name: '', className: '', grade: '3' });
  const [loginError, setLoginError] = useState('');
  const [shortAnswerText, setShortAnswerText] = useState('');

  // Form thêm/sửa câu hỏi
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [newQ, setNewQ] = useState({
    subject: 'Tin học', grade: '3', text: '', type: 'multiple_choice', lesson: '',
    opt0: '', opt1: '', opt2: '', opt3: '', correctIndex: '0', shortAnswerText: ''
  });

  // --- XỬ LÝ ĐĂNG NHẬP ---
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin123') { // Mật khẩu quản trị mặc định
      setIsAdmin(true);
      setActiveTab('admin');
      setLoginError('');
      AudioEngine.init();
      // Bắt đầu nhạc nền nhẹ
      if (audioRef.current) {
        audioRef.current.volume = 0.1;
        audioRef.current.play().then(() => setIsBgmPlaying(true)).catch(() => setIsBgmPlaying(false));
      }
    } else {
      setLoginError('Mật khẩu không đúng! Vui lòng thử lại.');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const pName = loginForm.name.trim();
    const pClass = loginForm.className.trim();
    
    if (!pName || !pClass) {
      setLoginError("Em nhớ điền đầy đủ Tên và Lớp nhé! 📝");
      return;
    }
    
    // Validate class name starts with grade and has letter
    const classPattern = new RegExp(`^${loginForm.grade}[a-zA-Z]+.*$`, 'i');
    if (!classPattern.test(pClass)) {
      setLoginError(`Tên lớp chưa hợp lệ! Học sinh Khối ${loginForm.grade} cần nhập lớp bắt đầu bằng số ${loginForm.grade} và kèm theo tên lớp (ví dụ: ${loginForm.grade}A, ${loginForm.grade}B, ${loginForm.grade}A1...) 📝`);
      return;
    }

    setLoginError('');
    AudioEngine.init();
    setStudent({ ...loginForm, name: pName, className: pClass.toUpperCase() });
    setActiveTab('select-subject'); // Chuyển đến màn hình chọn môn học
    
    // Bắt đầu nhạc nền
    if (audioRef.current) {
      audioRef.current.volume = 0.2; // Nhạc nền nhỏ
      audioRef.current.play().then(() => setIsBgmPlaying(true)).catch(e => {
        console.log("Auto-play prevented", e);
        setIsBgmPlaying(false);
      });
    }
  };

  const toggleBgm = () => {
    if (audioRef.current) {
      if (isBgmPlaying) {
        audioRef.current.pause();
        setIsBgmPlaying(false);
      } else {
        audioRef.current.volume = 0.2;
        audioRef.current.play().then(() => {
          setIsBgmPlaying(true);
        }).catch(e => {
          console.error("Audio play failed", e);
          setIsBgmPlaying(false);
          alert("Không thể tải nhạc nền lúc này. Vui lòng thử lại sau!");
        });
      }
    }
  };

  // --- LOGIC ÔN TẬP ---
  const loadQuestionsFor = useCallback((subject: string, grade: string, lesson: string | null = null, allQuestions: Question[] = questions) => {
    let filtered = allQuestions.filter(q => q.subject === subject && q.grade === grade);
    
    if (lesson === 'HK1' || lesson === 'HK2') {
      filtered = filtered.filter(q => q.lesson && isLessonInSemester(q.lesson, grade, subject, lesson));
    } else if (lesson) {
      filtered = filtered.filter(q => q.lesson === lesson);
    }
    
    // Tự động trộn ngẫu nhiên các câu hỏi
    let processed = shuffleArray<Question>(filtered).map((q: Question) => {
      if (q.type === 'short_answer') {
        return { ...q };
      }
      const optionsWithStatus = (q.options || []).map((opt, idx) => ({
        text: opt,
        isCorrect: idx === q.correctIndex,
        originalIndex: idx
      }));
      return {
        ...q,
        optionsObjects: shuffleArray(optionsWithStatus)
      };
    });

    // Chọn ngẫu nhiên tối đa 15 câu khi ôn tập học kì hoặc toàn bộ học phần
    if (lesson === 'HK1' || lesson === 'HK2' || lesson === null) {
      processed = processed.slice(0, 15);
    }

    setCurrentQuestions(processed);
    setCurrentQIndex(0);
    setScore(0);
    setIsFinished(false);
    setAnswerStatus(null);
  }, [questions]);

  useEffect(() => {
    if (student && activeTab === 'quiz') {
      loadQuestionsFor(currentSubject, student.grade, currentLesson);
    }
  }, [currentSubject, student, activeTab, loadQuestionsFor, currentLesson]);

  const finishQuiz = (finalScore: number) => {
    AudioEngine.playCongrats();
    setIsFinished(true);
    if (student) {
      const newRecord: QuizHistory = {
        id: Date.now().toString(),
        studentName: student.name,
        className: student.className,
        grade: student.grade,
        subject: currentSubject,
        score: finalScore,
        totalQuestions: currentQuestions.length,
        date: new Date().toLocaleString('vi-VN')
      };
      setHistory(prev => [newRecord, ...prev]);
    }
  };

  const handleShortAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answerStatus || !currentQuestions[currentQIndex]) return;
    
    const q = currentQuestions[currentQIndex];
    if (q.type !== 'short_answer') return;

    const isCorrect = (q.shortAnswers || []).some(
      ans => ans.toLowerCase() === shortAnswerText.trim().toLowerCase()
    );

    setAnswerStatus({ index: -1, isCorrect });
    if (isCorrect) {
      AudioEngine.playCorrect();
      setScore(s => s + 1);
    } else {
      AudioEngine.playWrong();
    }

    setTimeout(() => {
      setAnswerStatus(null);
      setShortAnswerText('');
      if (currentQIndex + 1 < currentQuestions.length) {
        setCurrentQIndex(currentQIndex + 1);
      } else {
        finishQuiz(isCorrect ? score + 1 : score);
      }
    }, 1500);
  };

  const handleAnswer = (idx: number, isCorrect: boolean) => {
    if (answerStatus) return; // Ngăn người dùng bấm liên tục khi đang hiện thông báo

    setAnswerStatus({ index: idx, isCorrect });

    if (isCorrect) {
      AudioEngine.playCorrect();
      setScore(s => s + 1);
    } else {
      AudioEngine.playWrong();
    }

    setTimeout(() => {
      setAnswerStatus(null);
      if (currentQIndex + 1 < currentQuestions.length) {
        setCurrentQIndex(currentQIndex + 1);
      } else {
        finishQuiz(isCorrect ? score + 1 : score);
      }
    }, 1500); // Tăng thời gian chờ lên 1.5s để học sinh kịp đọc thông báo
  };

  // --- LOGIC THÊM/SỬA CÂU HỎI ---
  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    let questionToSave: Question;

    if (newQ.type === 'short_answer') {
      if (!newQ.text || !newQ.shortAnswerText) {
        alert("Vui lòng điền đầy đủ câu hỏi và đáp án!");
        return;
      }
      questionToSave = {
        id: editingQuestionId || Date.now(),
        subject: newQ.subject,
        grade: newQ.grade,
        lesson: newQ.lesson || undefined,
        text: newQ.text,
        type: 'short_answer',
        shortAnswers: newQ.shortAnswerText.split(',').map(s => s.trim()).filter(s => s)
      };
    } else {
      if (!newQ.text || !newQ.opt0 || !newQ.opt1 || !newQ.opt2 || !newQ.opt3) {
        alert("Vui lòng điền đầy đủ câu hỏi và 4 đáp án!");
        return;
      }
      questionToSave = {
        id: editingQuestionId || Date.now(),
        subject: newQ.subject,
        grade: newQ.grade,
        lesson: newQ.lesson || undefined,
        text: newQ.text,
        type: 'multiple_choice',
        options: [newQ.opt0, newQ.opt1, newQ.opt2, newQ.opt3],
        correctIndex: parseInt(newQ.correctIndex)
      };
    }
    
    if (editingQuestionId) {
      setQuestions(questions.map(q => q.id === editingQuestionId ? questionToSave : q));
      alert("Cập nhật câu hỏi thành công!");
    } else {
      setQuestions([...questions, questionToSave]);
      alert("Thêm câu hỏi thành công!");
    }

    setEditingQuestionId(null);
    setNewQ({ ...newQ, text: '', opt0: '', opt1: '', opt2: '', opt3: '', correctIndex: '0', shortAnswerText: '' });
  };

  const handleEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setNewQ({
      subject: q.subject,
      grade: q.grade,
      text: q.text,
      type: q.type || 'multiple_choice',
      lesson: q.lesson || '',
      opt0: q.options?.[0] || '',
      opt1: q.options?.[1] || '',
      opt2: q.options?.[2] || '',
      opt3: q.options?.[3] || '',
      correctIndex: String(q.correctIndex || 0),
      shortAnswerText: q.shortAnswers?.join(', ') || ''
    });
  };

  const cancelEdit = () => {
    setEditingQuestionId(null);
    setNewQ({ ...newQ, text: '', opt0: '', opt1: '', opt2: '', opt3: '', correctIndex: '0', shortAnswerText: '' });
  };

  // ================= RENDER =================
  if (!student && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-300 via-purple-300 to-pink-300 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
             animate={{ y: [0, -30, 0], rotate: [0, 5, -5, 0] }} 
             transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
             className="absolute top-10 left-[10%] text-yellow-300 opacity-60 drop-shadow-md"
          >
            <Star size={80} fill="currentColor" />
          </motion.div>
          <motion.div 
             animate={{ y: [0, 40, 0], rotate: [0, -10, 10, 0] }} 
             transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
             className="absolute bottom-20 left-[15%] text-blue-200 opacity-80 drop-shadow-lg"
          >
            <Rocket size={100} fill="currentColor" />
          </motion.div>
          <motion.div 
             animate={{ x: [0, 20, 0], scale: [1, 1.1, 1] }} 
             transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
             className="absolute top-20 right-[15%] text-pink-200 opacity-80 drop-shadow-md"
          >
            <Smile size={110} fill="currentColor" />
          </motion.div>
          <motion.div 
             animate={{ scale: [1, 1.3, 1], rotate: [0, 180, 360] }} 
             transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
             className="absolute bottom-32 right-[10%] text-yellow-100 opacity-60 drop-shadow-xl"
          >
            <Sparkles size={90} fill="currentColor" />
          </motion.div>
          <motion.div 
             animate={{ x: [-20, 20, -20] }} 
             transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
             className="absolute top-1/2 left-[5%] text-white opacity-40 drop-shadow-sm"
          >
            <Cloud size={120} fill="currentColor" />
          </motion.div>
          <motion.div 
             animate={{ x: [20, -20, 20] }} 
             transition={{ repeat: Infinity, duration: 9, ease: "easeInOut" }}
             className="absolute top-1/3 right-[5%] text-white opacity-30 drop-shadow-md"
          >
            <Cloud size={150} fill="currentColor" />
          </motion.div>
        </div>

        <motion.div 
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
          className="bg-white/95 backdrop-blur-xl p-8 md:p-10 rounded-[3rem] shadow-[0_20px_50px_rgba(8,_112,_184,_0.2)] w-full max-w-lg text-center border-8 border-white/60 relative z-10"
        >
          <motion.div 
            animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", repeatDelay: 2 }}
            className="flex justify-center mb-6"
          >
            <div className="bg-gradient-to-br from-yellow-400 to-orange-400 p-5 rounded-full shadow-lg border-4 border-white">
              <BookOpen size={56} className="text-white" />
            </div>
          </motion.div>
          
          <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-2 drop-shadow-sm">Góc Ôn Tập</h1>
          <p className="text-gray-500 mb-8 font-medium text-lg">Cùng nhau học thật vui nhé!</p>
          
          {loginError && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-xl mb-6 relative font-bold text-sm shadow-sm"
            >
              {loginError}
            </motion.div>
          )}

          {loginMode === 'student' ? (
            <form onSubmit={handleLogin} className="space-y-5 text-left">
              <div>
                <label className="block text-sm font-extrabold text-blue-800 mb-2 uppercase tracking-wider">Tên của em:</label>
                <input 
                  type="text" 
                  value={loginForm.name}
                  onChange={e => setLoginForm({...loginForm, name: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl border-4 border-blue-100 hover:border-blue-200 focus:border-blue-500 focus:ring-0 outline-none transition-all text-lg font-bold text-gray-700 bg-blue-50/50"
                  placeholder="Ví dụ: Nam Anh"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="flex-1">
                  <label className="block text-sm font-extrabold text-green-800 mb-2 uppercase tracking-wider">Lớp:</label>
                  <input 
                    type="text" 
                    value={loginForm.className}
                    onChange={e => setLoginForm({...loginForm, className: e.target.value})}
                    className="w-full px-5 py-4 rounded-2xl border-4 border-green-100 hover:border-green-200 focus:border-green-500 focus:ring-0 outline-none transition-all text-lg font-bold text-gray-700 bg-green-50/50"
                    placeholder="Ví dụ: 3A"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-extrabold text-purple-800 mb-2 uppercase tracking-wider">Khối:</label>
                  <div className="relative">
                    <select 
                      value={loginForm.grade}
                      onChange={e => setLoginForm({...loginForm, grade: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border-4 border-purple-100 hover:border-purple-200 focus:border-purple-500 focus:ring-0 outline-none transition-all text-lg font-extrabold text-purple-600 bg-purple-50/50 appearance-none"
                    >
                      <option value="3">Khối 3</option>
                      <option value="4">Khối 4</option>
                      <option value="5">Khối 5</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-purple-600">
                      <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                className="w-full py-4 mt-6 bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white rounded-2xl font-black text-xl shadow-[0_10px_20px_rgba(59,_130,_246,_0.3)] transition-all flex items-center justify-center gap-3 border-b-4 border-blue-700"
              >
                <Play fill="currentColor" size={24} /> VÀO HỌC NGAY!
              </motion.button>
            </form>
          ) : (
            <motion.form 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={handleAdminLogin} className="space-y-5 text-left"
            >
              <div>
                <label className="block text-sm font-extrabold text-purple-800 mb-2 uppercase tracking-wider">Mật khẩu quản trị:</label>
                <input 
                  type="password" 
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border-4 border-purple-100 hover:border-purple-200 focus:border-purple-500 focus:ring-0 outline-none transition-all text-lg font-bold text-gray-700 bg-purple-50/50"
                  placeholder="Nhập mật khẩu..."
                />
                <p className="text-xs text-purple-600 font-medium mt-2 bg-purple-100 inline-block px-3 py-1 rounded-full">Mật khẩu mẫu: admin123</p>
              </div>
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                className="w-full py-4 mt-6 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-2xl font-black text-xl shadow-[0_10px_20px_rgba(124,_58,_237,_0.3)] transition-all flex items-center justify-center gap-3 border-b-4 border-indigo-800"
              >
                <User fill="currentColor" size={24} /> ĐĂNG NHẬP TRANG QUẢN TRỊ
              </motion.button>
            </motion.form>
          )}

          <div className="mt-8 text-center border-t-2 border-gray-100 pt-6">
            <button 
              onClick={() => {
                setLoginMode(loginMode === 'student' ? 'admin' : 'student');
                setLoginError('');
              }}
              className="text-gray-400 hover:text-indigo-600 font-bold transition-colors text-sm flex items-center justify-center gap-2 mx-auto"
            >
              {loginMode === 'student' ? 'Đăng nhập dành cho Quản trị viên' : 'Quay lại cổng đăng nhập Học sinh'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // MÀU SẮC CHO CÁC VIÊN CẦU (BUBBLES)
  const bubbleColors = [
    'bg-red-400 hover:bg-red-500 shadow-red-300',
    'bg-blue-400 hover:bg-blue-500 shadow-blue-300',
    'bg-green-400 hover:bg-green-500 shadow-green-300',
    'bg-yellow-400 hover:bg-yellow-500 shadow-yellow-300'
  ];

  return (
    <div className="min-h-screen bg-[#f0f9ff] flex flex-col md:flex-row font-sans">
      {/* Nhạc nền (Sử dụng URL nhạc không bản quyền êm dịu) */}
      <audio 
        ref={audioRef} 
        src={bgmSrc} 
        loop 
      />

      {/* --- SIDEBAR TRÁI --- */}
      {isAdmin ? (
        <div className="w-full md:w-80 lg:w-96 md:h-screen sticky top-0 bg-white shadow-xl flex flex-col z-20 border-r border-gray-100 flex-shrink-0">
          <div className="p-4 md:p-6 bg-gradient-to-b from-purple-500 to-indigo-600 text-white md:rounded-br-3xl flex justify-between items-center md:items-start md:flex-col">
            <div className="flex items-center gap-3 mb-0 md:mb-2">
              <div className="bg-white/20 p-2 rounded-full hidden sm:block md:block">
                <User size={24} />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-bold">Quản Trị Viên</h2>
                <p className="text-purple-100 text-xs md:text-sm">Trang Quản Lý</p>
              </div>
            </div>
            {/* Nút tác vụ cho Mobile */}
            <div className="flex md:hidden gap-2">
              <button onClick={toggleBgm} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                {isBgmPlaying ? <Volume2 size={20}/> : <VolumeX size={20}/>}
              </button>
              <button onClick={() => window.location.reload()} className="p-2 bg-red-400/80 rounded-full hover:bg-red-500 transition-colors">
                <LogOut size={20}/>
              </button>
            </div>
          </div>

          <div 
            className="p-2 md:p-4 flex-none flex flex-row md:flex-col gap-2 mt-0 md:mt-4 overflow-x-auto whitespace-nowrap items-center md:items-stretch [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            <p className="hidden md:block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Bảng Quản Trị</p>
            
            <button 
              onClick={() => { setActiveTab('history'); }}
              className={`flex items-center justify-center md:justify-start gap-2 md:gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl font-bold transition-all flex-shrink-0 ${
                activeTab === 'history' 
                ? 'bg-orange-100 text-orange-700 shadow-sm border-2 border-orange-200' 
                : 'text-gray-600 hover:bg-gray-50 border-2 border-transparent'
              }`}
            >
              <HistoryIcon size={20} className={activeTab === 'history' ? 'text-orange-600' : 'text-gray-400'} />
              <span className="text-sm md:text-base">Quản Lý Học Sinh</span>
            </button>
            <button 
              onClick={() => { setActiveTab('admin'); }}
              className={`flex items-center justify-center md:justify-start gap-2 md:gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl font-bold transition-all flex-shrink-0 ${
                activeTab === 'admin' 
                ? 'bg-purple-100 text-purple-700 shadow-sm border-2 border-purple-200' 
                : 'text-gray-600 hover:bg-gray-50 border-2 border-transparent'
              }`}
            >
              <PlusCircle size={20} className={activeTab === 'admin' ? 'text-purple-600' : 'text-gray-400'} />
              <span className="text-sm md:text-base">Quản Lý Câu Hỏi</span>
            </button>
          </div>

          {activeTab === 'admin' && (
            <div className="hidden md:flex flex-col flex-1 overflow-y-auto w-full border-t border-gray-100 p-4">
                 <h2 className="text-xl font-black text-gray-800 mb-4 flex items-center justify-between">
                   <span>Ngân hàng câu hỏi</span>
                   <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs">{questions.length} câu</span>
                 </h2>
                 
                 <div className="space-y-4 flex-1">
                   {['3', '4', '5'].map(grade => {
                     const qsForGrade = questions.filter(q => String(q.grade) === grade);
                     
                     return (
                       <details key={grade} className="group border-2 border-indigo-50 rounded-2xl overflow-hidden bg-indigo-50/30" open>
                         <summary className="cursor-pointer p-3 font-extrabold text-sm text-indigo-800 flex items-center gap-2 hover:bg-indigo-100 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                           <div className="w-5 h-5 flex items-center justify-center bg-indigo-200 text-indigo-700 rounded-sm group-open:rotate-90 transition-transform">
                             <ChevronLeft size={14} className="rotate-180" />
                           </div>
                           Khối {grade} ({qsForGrade.length})
                         </summary>
                         
                         <div className="p-3 pt-0 space-y-2">
                           {['Tin học', 'Công nghệ'].map(subject => {
                             const qsForSubject = qsForGrade.filter(q => q.subject === subject);
                             
                             return (
                               <details key={subject} className="group/sub border border-white rounded-xl overflow-hidden bg-white shadow-sm">
                                 <summary className="cursor-pointer p-2 font-bold text-gray-700 flex items-center justify-between hover:bg-gray-50 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                                   <div className="flex items-center gap-2 text-xs">
                                     <div className="w-4 h-4 flex items-center justify-center text-gray-400 group-open/sub:rotate-90 transition-transform">
                                       <ChevronLeft size={12} className="rotate-180" />
                                     </div>
                                     {subject === 'Tin học' ? <Monitor size={14} className="text-blue-500"/> : <Cpu size={14} className="text-green-500"/>}
                                     {subject}
                                   </div>
                                   <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-md text-gray-500">{qsForSubject.length}</span>
                                 </summary>
                                 
                                 <div className="p-2 border-t border-gray-100 bg-gray-50/50 space-y-2 max-h-[40vh] overflow-y-auto">
                                   {qsForSubject.length === 0 ? (
                                      <p className="text-[10px] text-gray-400 italic text-center py-2">Chưa có câu hỏi</p>
                                   ) : (
                                     Array.from(new Set(qsForSubject.map(q => q.lesson || 'Ôn tập chung'))).map(lesson => {
                                       const qsForLesson = qsForSubject.filter(q => (q.lesson || 'Ôn tập chung') === lesson);
                                       return (
                                         <details key={lesson} className="group/lesson border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
                                            <summary className="cursor-pointer p-2 text-xs font-semibold text-gray-600 flex items-center justify-between hover:bg-gray-50 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                                              <div className="flex items-center gap-1.5 truncate pr-2">
                                                 <div className="w-3 h-3 flex items-center justify-center text-gray-400 group-open/lesson:rotate-90 transition-transform flex-shrink-0">
                                                    <ChevronLeft size={10} className="rotate-180" />
                                                 </div>
                                                 <span className="truncate">{lesson}</span>
                                              </div>
                                              <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded-md text-gray-500 flex-shrink-0">{qsForLesson.length}</span>
                                            </summary>
                                            <div className="p-2 border-t border-gray-50 bg-gray-50/50 space-y-1.5">
                                              {qsForLesson.map((q, idx) => (
                                                <div 
                                                  key={idx} 
                                                  onClick={() => handleEditQuestion(q)}
                                                  className={`p-2 rounded shadow-sm border cursor-pointer transition-colors ${editingQuestionId === q.id ? 'bg-purple-100 border-purple-300' : 'bg-white border-gray-100 hover:bg-purple-50 hover:border-purple-200'}`}
                                                >
                                                  <p className="text-gray-800 text-[11px] font-medium line-clamp-2" title={q.text}>{q.text}</p>
                                                  <div className="mt-1 flex justify-end items-center gap-1">
                                                    <span className="text-[9px] font-bold text-gray-400">
                                                      {q.type === 'short_answer' ? 'Ngắn' : 'TN'}
                                                    </span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                         </details>
                                       )
                                     })
                                   )}
                                 </div>
                               </details>
                             );
                           })}
                         </div>
                       </details>
                     );
                   })}
                 </div>
            </div>
          )}

          <div className="hidden md:flex p-4 border-t border-gray-100 gap-2 mt-auto">
             <button 
                onClick={toggleBgm}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-semibold text-sm"
              >
                {isBgmPlaying ? <Volume2 size={18}/> : <VolumeX size={18}/>} Nhạc
              </button>
              <button 
                onClick={() => { window.location.reload(); }}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors font-semibold text-sm"
              >
                <LogOut size={18}/> Thoát
              </button>
          </div>
        </div>
      ) : (
        <div className="w-full md:w-72 md:h-screen sticky top-0 bg-white shadow-xl flex flex-col z-20 border-r border-gray-100 flex-shrink-0">
          <div className="p-4 md:p-6 bg-gradient-to-b from-blue-500 to-blue-600 text-white md:rounded-br-3xl flex justify-between items-center md:items-start md:flex-col">
            <div className="flex items-center gap-3 mb-0 md:mb-2">
              <div className="bg-white/20 p-2 rounded-full hidden sm:block md:block">
                <User size={24} />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-bold">{student?.name}</h2>
                <p className="text-blue-100 text-xs md:text-sm">Lớp {student?.className} - Khối {student?.grade}</p>
              </div>
            </div>
            
            {/* Nút tác vụ cho Mobile */}
            <div className="flex md:hidden gap-2">
              <button onClick={toggleBgm} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                {isBgmPlaying ? <Volume2 size={20}/> : <VolumeX size={20}/>}
              </button>
              <button onClick={() => window.location.reload()} className="p-2 bg-red-400/80 rounded-full hover:bg-red-500 transition-colors">
                <LogOut size={20}/>
              </button>
            </div>
          </div>

          <div 
            className="p-2 md:p-4 flex-none md:flex-1 flex flex-row md:flex-col gap-2 mt-0 md:mt-4 overflow-x-auto whitespace-nowrap items-center md:items-stretch [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            <p className="hidden md:block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Học Tập</p>
            
            <button 
              disabled={activeTab === 'select-subject'}
              onClick={() => { setActiveTab('select-lesson'); setCurrentSubject('Tin học'); }}
              className={`flex items-center justify-center md:justify-start gap-2 md:gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl font-bold transition-all flex-shrink-0 ${
                activeTab === 'select-subject' ? 'opacity-50 cursor-not-allowed grayscale' :
                activeTab === 'quiz' && currentSubject === 'Tin học' 
                ? 'bg-blue-100 text-blue-700 shadow-sm border-2 border-blue-200' 
                : 'text-gray-600 hover:bg-gray-50 border-2 border-transparent'
              }`}
            >
              <Monitor size={20} className={activeTab === 'quiz' && currentSubject === 'Tin học' ? 'text-blue-600' : 'text-gray-400'} />
              <span className="text-sm md:text-base">Môn Tin Học</span>
            </button>

            <button 
              disabled={activeTab === 'select-subject'}
              onClick={() => { setActiveTab('select-lesson'); setCurrentSubject('Công nghệ'); }}
              className={`flex items-center justify-center md:justify-start gap-2 md:gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl font-bold transition-all flex-shrink-0 ${
                activeTab === 'select-subject' ? 'opacity-50 cursor-not-allowed grayscale' :
                activeTab === 'quiz' && currentSubject === 'Công nghệ' 
                ? 'bg-green-100 text-green-700 shadow-sm border-2 border-green-200' 
                : 'text-gray-600 hover:bg-gray-50 border-2 border-transparent'
              }`}
            >
              <Cpu size={20} className={activeTab === 'quiz' && currentSubject === 'Công nghệ' ? 'text-green-600' : 'text-gray-400'} />
              <span className="text-sm md:text-base">Môn Công Nghệ</span>
            </button>

            <div className="hidden md:block h-px bg-gray-200 my-4"></div>
            
            <p className="hidden md:block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Thành Tích</p>
            <button 
              disabled={activeTab === 'select-subject'}
              onClick={() => { setActiveTab('history'); }}
              className={`flex items-center justify-center md:justify-start gap-2 md:gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl font-bold transition-all flex-shrink-0 ${
                activeTab === 'select-subject' ? 'opacity-50 cursor-not-allowed grayscale' :
                activeTab === 'history' 
                ? 'bg-orange-100 text-orange-700 shadow-sm border-2 border-orange-200' 
                : 'text-gray-600 hover:bg-gray-50 border-2 border-transparent'
              }`}
            >
              <HistoryIcon size={20} className={activeTab === 'history' ? 'text-orange-600' : 'text-gray-400'} />
              <span className="text-sm md:text-base">Lịch Sử Thi</span>
            </button>
            <button 
              disabled={activeTab === 'select-subject'}
              onClick={() => { setActiveTab('leaderboard'); }}
              className={`flex items-center justify-center md:justify-start gap-2 md:gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl font-bold transition-all flex-shrink-0 ${
                activeTab === 'select-subject' ? 'opacity-50 cursor-not-allowed grayscale' :
                activeTab === 'leaderboard' 
                ? 'bg-yellow-100 text-yellow-700 shadow-sm border-2 border-yellow-200' 
                : 'text-gray-600 hover:bg-gray-50 border-2 border-transparent'
              }`}
            >
              <Award size={20} className={activeTab === 'leaderboard' ? 'text-yellow-600' : 'text-gray-400'} />
              <span className="text-sm md:text-base">Bảng Xếp Hạng</span>
            </button>
          </div>

          <div className="hidden md:flex p-4 border-t border-gray-100 gap-2 mt-auto">
             <button 
                onClick={toggleBgm}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-semibold text-sm"
              >
                {isBgmPlaying ? <Volume2 size={18}/> : <VolumeX size={18}/>} Nhạc
              </button>
              <button 
                onClick={() => { window.location.reload(); }}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors font-semibold text-sm"
              >
                <LogOut size={18}/> Thoát
              </button>
          </div>
        </div>
      )}

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto relative">
        
        {/* VIEW: CHỌN MÔN HỌC */}
        {activeTab === 'select-subject' && !isAdmin && (
          <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center relative z-10 w-full pt-10">
            <motion.div 
               initial={{ y: -50, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               transition={{ type: "spring", bounce: 0.6 }}
               className="mb-10 w-full"
            >
              <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-green-500 mb-4 drop-shadow-sm leading-tight">
                Chào {student?.name}! <br className="md:hidden" /> Hôm nay em muốn khám phá gì nè?
              </h1>
              <p className="text-xl text-gray-500 font-medium">Hãy chọn một hành tinh môn học để bắt đầu nhé! 🚀</p>
            </motion.div>
            
            <div className="flex flex-col sm:flex-row gap-8 w-full justify-center max-w-3xl">
              <motion.button 
                whileHover={{ scale: 1.05, y: -10 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setCurrentSubject('Tin học');
                  setActiveTab('select-lesson');
                  AudioEngine.playHover();
                }}
                className="flex-1 bg-white border-8 border-blue-100 hover:border-blue-400 p-8 rounded-[3rem] shadow-[0_20px_40px_rgba(59,_130,_246,_0.15)] transition-all flex flex-col items-center relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full mix-blend-multiply filter blur-2xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-50 rounded-full mix-blend-multiply filter blur-2xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="bg-gradient-to-br from-blue-400 to-indigo-500 p-6 rounded-3xl mb-6 shadow-lg z-10"
                >
                  <Monitor size={64} className="text-white relative z-10" />
                </motion.div>
                <h2 className="text-3xl font-black text-gray-800 mb-2 relative z-10">Tin Học</h2>
                <p className="text-gray-500 font-medium relative z-10">Thế giới máy tính diệu kỳ</p>
                <div className="mt-6 bg-blue-100 text-blue-700 px-6 py-2 rounded-full font-bold relative z-10 flex border-2 border-blue-200">
                  Bay đến ngay! <Sparkles className="ml-2 w-5 h-5"/>
                </div>
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.05, y: -10 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setCurrentSubject('Công nghệ');
                  setActiveTab('select-lesson');
                  AudioEngine.playHover();
                }}
                className="flex-1 bg-white border-8 border-green-100 hover:border-green-400 p-8 rounded-[3rem] shadow-[0_20px_40px_rgba(16,_185,_129,_0.15)] transition-all flex flex-col items-center relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 w-32 h-32 bg-green-50 rounded-full mix-blend-multiply filter blur-2xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-teal-50 rounded-full mix-blend-multiply filter blur-2xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.5 }}
                  className="bg-gradient-to-br from-green-400 to-emerald-500 p-6 rounded-3xl mb-6 shadow-lg z-10"
                >
                  <Cpu size={64} className="text-white relative z-10" />
                </motion.div>
                <h2 className="text-3xl font-black text-gray-800 mb-2 relative z-10">Công Nghệ</h2>
                <p className="text-gray-500 font-medium relative z-10">Khám phá đồ vật quanh ta</p>
                <div className="mt-6 bg-green-100 text-green-700 px-6 py-2 rounded-full font-bold relative z-10 flex border-2 border-green-200">
                  Bay đến ngay! <Rocket className="ml-2 w-5 h-5"/>
                </div>
              </motion.button>
            </div>
          </div>
        )}

        {/* VIEW: CHỌN BÀI HỌC */}
        {activeTab === 'select-lesson' && student && (
          <div className="max-w-4xl mx-auto flex flex-col items-center justify-start min-h-[60vh] transform transition-all duration-500 pt-8">
            <div className="flex w-full justify-between items-center mb-8">
               <button 
                  onClick={() => {
                    setActiveTab('select-subject');
                    AudioEngine.playHover();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-bold transition-colors"
               >
                 <ChevronLeft size={20}/>
                 Quay Lại
               </button>
               <h1 className="text-3xl font-extrabold text-gray-800 flex items-center gap-3">
                  <BookText className="text-blue-500" size={32}/>
                  Danh Sách Bài Học - {currentSubject} Khối {student.grade}
               </h1>
               <div className="w-[100px]"></div> {/* Spacer */}
            </div>
            
            <div className="w-full bg-white rounded-3xl shadow-xl overflow-hidden p-6 border-2 border-gray-100">
               {/* Ôn tập định kì */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 pb-8 border-b-2 border-dashed border-gray-200">
                 <button
                   onClick={() => {
                     setCurrentLesson('HK1');
                     setActiveTab('quiz');
                     AudioEngine.playHover();
                   }}
                   className="flex items-center justify-center gap-3 p-6 bg-gradient-to-r from-orange-400 to-orange-500 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all text-white font-bold text-lg"
                 >
                   <Award size={28} />
                   Ôn Tập Học Kì 1
                 </button>
                 <button
                   onClick={() => {
                     setCurrentLesson('HK2');
                     setActiveTab('quiz');
                     AudioEngine.playHover();
                   }}
                   className="flex items-center justify-center gap-3 p-6 bg-gradient-to-r from-pink-400 to-rose-500 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all text-white font-bold text-lg"
                 >
                   <Award size={28} />
                   Ôn Tập Học Kì 2
                 </button>
               </div>

               {LESSONS_DATA[student.grade]?.[currentSubject]?.length > 0 ? (
                  <div className="space-y-6">
                    {LESSONS_DATA[student.grade][currentSubject].map((topicGroup, idx) => (
                      <div key={idx} className="mb-6">
                        {topicGroup.topic && (
                          <h3 className="text-lg font-bold text-gray-700 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            {topicGroup.topic}
                          </h3>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {topicGroup.lessons.map((lesson, lIdx) => (
                              <button
                                key={lIdx}
                                onClick={() => {
                                  setCurrentLesson(lesson);
                                  setActiveTab('quiz');
                                  AudioEngine.playHover();
                                }}
                                className="flex text-left items-center justify-between p-4 bg-white border-2 border-gray-200 rounded-2xl hover:border-blue-400 hover:shadow-md transition-all group"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="bg-blue-50 p-3 rounded-full text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                    <BookOpen size={20} />
                                  </div>
                                  <span className="font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">
                                    {lesson}
                                  </span>
                                </div>
                                <Play size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors"/>
                              </button>
                           ))}
                        </div>
                      </div>
                    ))}
                  </div>
               ) : (
                 <div className="text-center py-10 text-gray-500 font-medium flex flex-col items-center">
                    <BookText size={48} className="mb-4 text-gray-300"/>
                    <p>Chưa có danh sách bài học cho môn học này.</p>
                    <button 
                      onClick={() => {
                        setCurrentLesson(null); // Ôn tập chung
                        setActiveTab('quiz');
                        AudioEngine.playHover();
                      }}
                      className="mt-6 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-md hover:shadow-lg transition-all"
                    >
                      Bỏ Qua & Ôn Tập Chung
                    </button>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* VIEW: ÔN TẬP */}
        {activeTab === 'quiz' && (
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
              <button 
                onClick={() => {
                  setActiveTab('select-lesson');
                  AudioEngine.playHover();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-bold transition-colors self-start"
              >
                <ChevronLeft size={20}/>
                Quay Lại
              </button>
              <h1 className="text-3xl font-extrabold text-gray-800 flex items-center gap-3">
                {currentSubject === 'Tin học' ? <Monitor className="text-blue-500" size={36}/> : <Cpu className="text-green-500" size={36}/>}
                Ôn Tập {currentSubject} {currentLesson === 'HK1' ? 'Học Kì 1' : currentLesson === 'HK2' ? 'Học Kì 2' : ''}
                <span className="bg-yellow-100 text-yellow-800 text-lg px-3 py-1 rounded-full ml-2">Khối {student.grade}</span>
              </h1>
            </div>

            {currentQuestions.length === 0 ? (
              <div className="bg-white p-10 rounded-3xl shadow-sm text-center border-2 border-dashed border-gray-300">
                <div className="text-gray-400 mb-4 flex justify-center"><BookOpen size={64}/></div>
                <h2 className="text-2xl font-bold text-gray-600">Chưa có câu hỏi nào!</h2>
                <p className="text-gray-500 mt-2">Nhờ thầy cô hoặc bố mẹ thêm câu hỏi cho phần này nhé.</p>
              </div>
            ) : isFinished ? (
              <div className="bg-white p-12 rounded-3xl shadow-2xl text-center transform animate-fade-in-up">
                <Trophy size={80} className="text-yellow-400 mx-auto mb-6 animate-bounce" />
                <h2 className="text-4xl font-extrabold text-green-500 mb-4">Chúc mừng em hoàn thành!</h2>
                <p className="text-2xl font-bold text-gray-700 mb-8">
                  Số điểm đạt được: <span className="text-4xl text-blue-600">{score} / {currentQuestions.length}</span>
                </p>
                <button 
                  onClick={() => loadQuestionsFor(currentSubject, student.grade, currentLesson)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all"
                >
                  Chơi Lại Nào!
                </button>
              </div>
            ) : (
              <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden border-4 border-white">
                {/* Progress bar */}
                <div className="w-full bg-gray-100 h-4 rounded-full mb-8 overflow-hidden">
                  <div 
                    className="bg-green-400 h-full transition-all duration-500 ease-out"
                    style={{ width: `${(currentQIndex / currentQuestions.length) * 100}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-center mb-6 text-gray-500 font-bold">
                  <span className="bg-gray-100 px-4 py-1 rounded-full text-sm uppercase tracking-wider">
                    Câu hỏi {currentQIndex + 1} / {currentQuestions.length}
                  </span>
                  <span className="flex items-center gap-1 text-yellow-500">
                    <Trophy size={18} /> Điểm: {score}
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-800 mb-8 sm:mb-10 leading-tight">
                  {currentQuestions[currentQIndex].text}
                </h2>

                {/* Các viên cầu đáp án hoặc input trả lời ngắn */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 relative">
                  {answerStatus && (
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-10 animate-bounce w-full text-center pointer-events-none">
                      {answerStatus.isCorrect ? (
                        <div className="inline-flex bg-green-500 text-white px-6 py-2 rounded-full font-bold text-lg sm:text-xl shadow-lg items-center gap-2 border-2 border-white">
                          <CheckCircle size={24} /> Chính xác! Quá giỏi!
                        </div>
                      ) : (
                        <div className="inline-flex bg-red-500 text-white px-6 py-2 rounded-full font-bold text-lg sm:text-xl shadow-lg items-center gap-2 border-2 border-white">
                          <XCircle size={24} /> Sai rồi! Cố lên nhé!
                        </div>
                      )}
                    </div>
                  )}

                  {currentQuestions[currentQIndex].type === 'short_answer' ? (
                    <div className="col-span-1 md:col-span-2">
                       <form onSubmit={handleShortAnswerSubmit} className="flex flex-col gap-4">
                         <input 
                           type="text" 
                           value={shortAnswerText}
                           onChange={e => setShortAnswerText(e.target.value)}
                           disabled={!!answerStatus}
                           className="w-full px-6 py-4 rounded-3xl border-4 border-blue-200 focus:border-blue-500 outline-none text-2xl font-bold text-gray-700 shadow-inner"
                           placeholder="Nhập câu trả lời của em ở đây..."
                           autoFocus
                         />
                         <button 
                           type="submit" 
                           disabled={!!answerStatus || !shortAnswerText.trim()}
                           className="self-end bg-blue-500 disabled:bg-gray-400 hover:bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-xl shadow-lg hover:-translate-y-1 transition-all flex items-center gap-2"
                         >
                            <CheckCircle /> Trả lời
                         </button>
                       </form>
                    </div>
                  ) : (currentQuestions[currentQIndex].optionsObjects || []).map((opt, idx) => {
                    let btnStyle = `${bubbleColors[idx % bubbleColors.length]} hover:scale-[1.02] hover:-translate-y-1 sm:hover:-translate-y-2 active:translate-y-1`;
                    
                    if (answerStatus) {
                      if (idx === answerStatus.index) {
                         // Nút người dùng vừa chọn
                         btnStyle = opt.isCorrect ? 'bg-green-500 shadow-green-300 scale-[1.02]' : 'bg-red-500 shadow-red-300 scale-[1.02]';
                      } else if (opt.isCorrect) {
                         // Gợi ý luôn đáp án đúng nếu người dùng chọn sai
                         btnStyle = 'bg-green-500 shadow-green-300 animate-pulse'; 
                      } else {
                         // Các nút còn lại làm mờ đi
                         btnStyle = 'bg-gray-300 shadow-gray-200 opacity-50 grayscale';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={!!answerStatus}
                        onMouseEnter={() => !answerStatus && AudioEngine.playHover()}
                        onClick={() => handleAnswer(idx, opt.isCorrect)}
                        className={`text-white p-4 sm:p-6 rounded-3xl sm:rounded-[3rem] shadow-lg transition-all text-left flex items-center gap-3 sm:gap-4 group min-h-[80px] sm:min-h-[100px] border-b-4 border-black/20 active:border-b-0 ${btnStyle}`}
                      >
                        <div className="bg-white/20 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-black text-xl sm:text-2xl group-hover:bg-white group-hover:text-black transition-colors flex-shrink-0">
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="text-lg sm:text-xl md:text-2xl font-bold leading-tight drop-shadow-md">
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: QUẢN LÝ CÂU HỎI */}
        {activeTab === 'admin' && (
          <div className="max-w-4xl mx-auto w-full">
            <h1 className="text-3xl font-extrabold text-purple-700 flex items-center gap-3 mb-8">
              <PlusCircle size={36}/> Trang Quản Trị
            </h1>

            <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-purple-500">
              <h2 className="text-2xl font-black text-gray-800 mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <PlusCircle className="text-purple-600" /> {editingQuestionId ? 'Sửa Câu Hỏi' : 'Thêm Câu Hỏi Mới'}
                </span>
                {editingQuestionId && (
                  <button onClick={cancelEdit} className="text-sm bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-200 transition-colors">Hủy sửa</button>
                )}
              </h2>
              <form onSubmit={handleSaveQuestion} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Loại câu hỏi</label>
                      <select 
                        value={newQ.type}
                        onChange={e => setNewQ({...newQ, type: e.target.value as 'multiple_choice' | 'short_answer'})}
                        className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none font-bold text-gray-700"
                      >
                        <option value="multiple_choice">Trắc nghiệm</option>
                        <option value="short_answer">Trả lời ngắn</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Môn học</label>
                      <select 
                        value={newQ.subject}
                        onChange={e => setNewQ({...newQ, subject: e.target.value, lesson: ''})}
                        className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none font-bold text-gray-700"
                      >
                        <option value="Tin học">Tin học</option>
                        <option value="Công nghệ">Công nghệ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Khối lớp</label>
                      <select 
                        value={newQ.grade}
                        onChange={e => setNewQ({...newQ, grade: e.target.value, lesson: ''})}
                        className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none font-bold text-gray-700"
                      >
                        <option value="3">Khối 3</option>
                        <option value="4">Khối 4</option>
                        <option value="5">Khối 5</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Bài học (Tùy chọn)</label>
                      <select 
                        value={newQ.lesson}
                        onChange={e => setNewQ({...newQ, lesson: e.target.value})}
                        className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none font-bold text-gray-700"
                      >
                        <option value="">-- Chọn bài học hoặc để trống --</option>
                        {LESSONS_DATA[newQ.grade]?.[newQ.subject]?.flatMap(topic => topic.lessons).map((lesson, idx) => (
                          <option key={idx} value={lesson}>{lesson}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Nội dung câu hỏi</label>
                    <textarea 
                      value={newQ.text}
                      onChange={e => setNewQ({...newQ, text: e.target.value})}
                      className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none text-lg min-h-[100px]"
                      placeholder="Nhập nội dung câu hỏi..."
                    />
                  </div>

                  {newQ.type === 'short_answer' ? (
                    <div className="space-y-4">
                      <label className="block text-sm font-bold text-gray-700">Đáp án (Các phương án đúng cách nhau bằng dấu phẩy)</label>
                      <input 
                        type="text" 
                        value={newQ.shortAnswerText}
                        onChange={e => setNewQ({...newQ, shortAnswerText: e.target.value})}
                        className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-purple-500 outline-none"
                        placeholder="VD: Màn hình, man hinh, Man hinh"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="block text-sm font-bold text-gray-700">Các đáp án (Tích chọn vào ô đúng nhất)</label>
                      {[0, 1, 2, 3].map(idx => (
                        <div key={idx} className="flex items-center gap-4 bg-gray-50 p-2 rounded-xl border-2 border-transparent focus-within:border-purple-200 transition-colors">
                          <input 
                            type="radio" 
                            name="correctOption" 
                            value={idx}
                            checked={newQ.correctIndex === String(idx)}
                            onChange={e => setNewQ({...newQ, correctIndex: e.target.value})}
                            className="w-6 h-6 text-purple-600 focus:ring-purple-500 cursor-pointer ml-2"
                          />
                          <input 
                            type="text" 
                            value={(newQ as any)[`opt${idx}`]}
                            onChange={e => setNewQ({...newQ, [`opt${idx}`]: e.target.value})}
                            className="flex-1 p-3 rounded-lg border border-gray-300 focus:border-purple-500 outline-none"
                            placeholder={`Đáp án ${String.fromCharCode(65 + idx)}...`}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full py-4 mt-6 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xl shadow-lg transform hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={24} /> {editingQuestionId ? 'Cập Nhật Câu Hỏi' : 'Lưu Câu Hỏi Này'}
                  </button>
                </form>
              </div>
          </div>
        )}

        {/* VIEW: LỊCH SỬ THI */}
        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-extrabold text-orange-600 flex items-center gap-3 mb-8">
              <HistoryIcon size={36}/> Lịch Sử Ôn Tập
            </h1>
            {history.length === 0 ? (
              <div className="bg-white p-10 rounded-3xl shadow-sm text-center border-2 border-dashed border-gray-300">
                <p className="text-gray-500">Chưa có lịch sử thi nào.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-orange-50 text-orange-800">
                      <tr>
                        <th className="p-4 font-bold">Thời gian</th>
                        <th className="p-4 font-bold">Học sinh</th>
                        <th className="p-4 font-bold">Lớp</th>
                        <th className="p-4 font-bold">Môn</th>
                        <th className="p-4 font-bold text-center">Khối</th>
                        <th className="p-4 font-bold text-center">Điểm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {history.map((record) => (
                        <tr key={record.id} className="hover:bg-orange-50/50 transition-colors">
                          <td className="p-4 text-sm text-gray-500">{record.date}</td>
                          <td className="p-4 font-bold text-gray-800">{record.studentName}</td>
                          <td className="p-4 text-gray-600">{record.className}</td>
                          <td className="p-4 text-blue-600 font-medium">{record.subject}</td>
                          <td className="p-4 text-center">
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm font-bold">{record.grade}</span>
                          </td>
                          <td className="p-4 text-center font-extrabold text-green-500 text-lg">
                            {record.score}/{record.totalQuestions}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: BẢNG XẾP HẠNG */}
        {activeTab === 'leaderboard' && !isAdmin && (
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-extrabold text-yellow-600 flex items-center gap-3 mb-8">
              <Award size={36}/> Bảng Xếp Hạng - Khối {student?.grade}
            </h1>
            {history.filter(h => h.grade === student?.grade).length === 0 ? (
              <div className="bg-white p-10 rounded-3xl shadow-sm text-center border-2 border-dashed border-gray-300">
                <p className="text-gray-500">Chưa có dữ liệu để xếp hạng cho khối này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['Tin học', 'Công nghệ'].map(subject => {
                  const subjectRecords = history.filter(h => h.grade === student?.grade && h.subject === subject);
                  const bestScores = new Map<string, QuizHistory>();
                  subjectRecords.forEach(record => {
                    const key = `${record.studentName}-${record.className}`;
                    if (!bestScores.has(key) || record.score > bestScores.get(key)!.score) {
                      bestScores.set(key, record);
                    }
                  });
                  const topStudents = Array.from(bestScores.values())
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10);

                  return (
                    <div key={subject} className="bg-white rounded-3xl shadow-xl overflow-hidden border-t-8 border-yellow-400">
                      <div className="bg-yellow-50 p-4 text-center border-b border-yellow-100">
                        <h2 className="text-2xl font-black text-yellow-700">Môn {subject}</h2>
                      </div>
                      <div className="p-4">
                        {topStudents.length === 0 ? (
                          <p className="text-center text-gray-400 text-sm py-4">Chưa có ai thi môn này</p>
                        ) : (
                          <div className="space-y-3">
                            {topStudents.map((scoreRecord, index) => (
                              <div key={scoreRecord.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                  index === 0 ? 'bg-yellow-400 text-white' :
                                  index === 1 ? 'bg-gray-300 text-gray-700' :
                                  index === 2 ? 'bg-amber-600 text-white' :
                                  'bg-gray-100 text-gray-500'
                                }`}>
                                  {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-gray-800 truncate">{scoreRecord.studentName}</p>
                                  <p className="text-xs text-gray-500">Lớp {scoreRecord.className}</p>
                                </div>
                                <div className="font-black text-green-500">
                                  {scoreRecord.score}đ
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
