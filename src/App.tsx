import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, BookOpen, Monitor, Cpu, PlusCircle, Shuffle, 
  CheckCircle, XCircle, Volume2, VolumeX, Trophy, User, LogOut,
  History as HistoryIcon, Award, BookText, ChevronLeft
} from 'lucide-react';

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

  // Form thêm câu hỏi
  const [newQ, setNewQ] = useState({
    subject: 'Tin học', grade: '3', text: '', type: 'multiple_choice', lesson: '',
    opt0: '', opt1: '', opt2: '', opt3: '', correctIndex: '0', shortAnswerText: ''
  });

  // --- XỬ LÝ ĐĂNG NHẬP ---
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
    if (lesson) {
      filtered = filtered.filter(q => q.lesson === lesson);
    }
    
    // Tự động trộn ngẫu nhiên các câu hỏi
    const processed = shuffleArray<Question>(filtered).map((q: Question) => {
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

  // --- LOGIC THÊM CÂU HỎI ---
  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    let questionToAdd: Question;

    if (newQ.type === 'short_answer') {
      if (!newQ.text || !newQ.shortAnswerText) {
        alert("Vui lòng điền đầy đủ câu hỏi và đáp án!");
        return;
      }
      questionToAdd = {
        id: Date.now(),
        subject: newQ.subject,
        grade: newQ.grade,
        text: newQ.text,
        type: 'short_answer',
        shortAnswers: newQ.shortAnswerText.split(',').map(s => s.trim()).filter(s => s)
      };
    } else {
      if (!newQ.text || !newQ.opt0 || !newQ.opt1 || !newQ.opt2 || !newQ.opt3) {
        alert("Vui lòng điền đầy đủ câu hỏi và 4 đáp án!");
        return;
      }
      questionToAdd = {
        id: Date.now(),
        subject: newQ.subject,
        grade: newQ.grade,
        text: newQ.text,
        type: 'multiple_choice',
        options: [newQ.opt0, newQ.opt1, newQ.opt2, newQ.opt3],
        correctIndex: parseInt(newQ.correctIndex)
      };
    }
    
    setQuestions([...questions, questionToAdd]);
    alert("Thêm câu hỏi thành công!");
    setNewQ({ ...newQ, text: '', opt0: '', opt1: '', opt2: '', opt3: '', correctIndex: '0', shortAnswerText: '' });
    
    // Refresh danh sách nếu đang ở đúng môn và khối
    if (student && currentSubject === newQ.subject && student.grade === newQ.grade) {
       loadQuestionsFor(currentSubject, student.grade, [...questions, questionToAdd]);
    }
  };

  // ================= RENDER =================
  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-300 via-purple-300 to-pink-300 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center border-4 border-white transform transition-all hover:scale-105 duration-300">
          <div className="flex justify-center mb-4">
            <div className="bg-yellow-400 p-4 rounded-full shadow-lg">
              <BookOpen size={48} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-blue-600 mb-2">Góc Ôn Tập</h1>
          <p className="text-gray-500 mb-6 font-medium">Cùng nhau học thật vui nhé!</p>
          
          {loginError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4 relative font-bold animate-pulse text-sm">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Tên của em:</label>
              <input 
                type="text" 
                value={loginForm.name}
                onChange={e => setLoginForm({...loginForm, name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border-2 border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none transition-all text-lg"
                placeholder="Ví dụ: Nam Anh"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Lớp:</label>
                <input 
                  type="text" 
                  value={loginForm.className}
                  onChange={e => setLoginForm({...loginForm, className: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border-2 border-blue-200 focus:border-blue-500 outline-none text-lg"
                  placeholder="Ví dụ: 3A"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Khối:</label>
                <select 
                  value={loginForm.grade}
                  onChange={e => setLoginForm({...loginForm, grade: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border-2 border-blue-200 focus:border-blue-500 outline-none text-lg font-bold text-blue-600 bg-white"
                >
                  <option value="3">Khối 3</option>
                  <option value="4">Khối 4</option>
                  <option value="5">Khối 5</option>
                </select>
              </div>
            </div>
            <button 
              type="submit"
              className="w-full py-4 mt-4 bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white rounded-2xl font-bold text-xl shadow-lg transform hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
            >
              <Play fill="currentColor" /> Vào Học Ngay!
            </button>
          </form>
        </div>
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
      <div className="w-full md:w-72 md:h-screen sticky top-0 bg-white shadow-xl flex flex-col z-20 border-r border-gray-100 flex-shrink-0">
        <div className="p-4 md:p-6 bg-gradient-to-b from-blue-500 to-blue-600 text-white md:rounded-br-3xl flex justify-between items-center md:items-start md:flex-col">
          <div className="flex items-center gap-3 mb-0 md:mb-2">
            <div className="bg-white/20 p-2 rounded-full hidden sm:block md:block">
              <User size={24} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold">{student.name}</h2>
              <p className="text-blue-100 text-xs md:text-sm">Lớp {student.className} - Khối {student.grade}</p>
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

          <div className="hidden md:block h-px bg-gray-200 my-4"></div>
          
          <p className="hidden md:block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Giáo Viên / Phụ Huynh</p>
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

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto relative">
        
        {/* VIEW: CHỌN MÔN HỌC */}
        {activeTab === 'select-subject' && (
          <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center transform transition-all duration-500">
            <h1 className="text-4xl md:text-5xl font-extrabold text-blue-600 mb-6 drop-shadow-sm">
              Chào {student.name}! Em muốn ôn tập môn nào?
            </h1>
            <p className="text-xl text-gray-500 mb-12 font-medium">Hãy nhấp vào một môn học dưới đây để bắt đầu nhé.</p>
            
            <div className="flex flex-col sm:flex-row gap-8 w-full justify-center max-w-3xl">
              <button 
                onClick={() => {
                  setCurrentSubject('Tin học');
                  setActiveTab('select-lesson');
                  AudioEngine.playHover();
                }}
                className="flex-1 bg-white border-4 border-blue-200 hover:border-blue-500 p-8 rounded-[3rem] shadow-xl hover:shadow-2xl transform hover:-translate-y-2 transition-all flex flex-col items-center group"
              >
                <div className="bg-blue-100 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform">
                  <Monitor size={64} className="text-blue-500" />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-800 mb-2">Tin Học</h2>
                <p className="text-gray-500 font-medium">Khám phá thế giới máy tính</p>
              </button>

              <button 
                onClick={() => {
                  setCurrentSubject('Công nghệ');
                  setActiveTab('select-lesson');
                  AudioEngine.playHover();
                }}
                className="flex-1 bg-white border-4 border-green-200 hover:border-green-500 p-8 rounded-[3rem] shadow-xl hover:shadow-2xl transform hover:-translate-y-2 transition-all flex flex-col items-center group"
              >
                <div className="bg-green-100 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform">
                  <Cpu size={64} className="text-green-500" />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-800 mb-2">Công Nghệ</h2>
                <p className="text-gray-500 font-medium">Tìm hiểu vật dụng quanh ta</p>
              </button>
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
            
            {/* Quick action to just review all */}
             {LESSONS_DATA[student.grade]?.[currentSubject]?.length > 0 && (
                <div className="mt-8">
                  <button 
                    onClick={() => {
                      setCurrentLesson(null);
                      setActiveTab('quiz');
                      AudioEngine.playHover();
                    }}
                    className="flex items-center gap-2 px-8 py-4 bg-gray-800 hover:bg-gray-900 text-white rounded-full font-bold shadow-lg transition-all hover:-translate-y-1"
                  >
                    <Shuffle size={20}/>
                    Ôn Tập Toàn Bộ Môn Này
                  </button>
                </div>
             )}
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
                Ôn Tập {currentSubject}
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
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-extrabold text-purple-700 flex items-center gap-3 mb-8">
              <PlusCircle size={36}/> Thêm Câu Hỏi Mới
            </h1>

            <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-purple-500">
              <form onSubmit={handleAddQuestion} className="space-y-6">
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
                  <CheckCircle size={24} /> Lưu Câu Hỏi Này
                </button>
              </form>
            </div>
            
            <div className="mt-8">
               <h2 className="text-xl font-bold text-gray-700 mb-4">Danh sách câu hỏi hiện tại ({questions.length})</h2>
               <div className="bg-white rounded-xl shadow p-4 max-h-60 overflow-y-auto">
                 {questions.map((q, i) => (
                    <div key={i} className="border-b border-gray-100 py-3 last:border-0 flex gap-2">
                       <span className="font-bold text-blue-500 min-w-[50px]">Lớp {q.grade}</span>
                       <span className="font-bold text-green-600 min-w-[80px]">{q.subject}</span>
                       <span className="text-gray-700 truncate">{q.text}</span>
                    </div>
                 ))}
               </div>
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
        {activeTab === 'leaderboard' && (
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
