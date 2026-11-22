import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Film, Play, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import type { LandmarkPoint, SignVideoLesson, ThemeMode } from '../types/signlens';
import {
  deleteVideoLesson,
  getAllVideoLessons,
  saveVideoLesson,
} from '../utils/indexedDb';
import {
  extractYouTubeId,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  getYouTubeWatchUrl,
} from '../utils/youtube';
import {
  VSL_CHOREO_COURSES,
  VSL_LESSONS_DATA,
  type VslLessonItem,
  renderArticulatedHandCanvas,
} from '../utils/vslChoreographer';
import { speakVietnameseText } from '../utils/gestureEngine';
import { HandLessonSvg, SpeakerSvg } from './Icons';

interface LearnPageProps {
  theme: ThemeMode;
  onToast: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
}

interface HandLandmarkerLike {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => { landmarks?: LandmarkPoint[][] };
}

const YT_CATEGORIES = [
  { key: 'all', label: 'Tất cả' },
  { key: 'chào_hỏi', label: 'Chào hỏi' },
  { key: 'số_đếm', label: 'Số đếm' },
  { key: 'giao_tiếp', label: 'Giao tiếp' },
  { key: 'y_tế', label: 'Y tế' },
  { key: 'khác', label: 'Khác' },
];

export default function LearnPage({ theme, onToast }: LearnPageProps) {
  const [sectionTab, setSectionTab] = useState<'choreo' | 'youtube'>('choreo');

  // Animated Choreographer state
  const [choreoCourseIdx, setChoreoCourseIdx] = useState(0);
  const [choreoStepIdx, setChoreoStepIdx] = useState(0);
  const [choreoPaused, setChoreoPaused] = useState(false);
  const [choreoSlow, setChoreoSlow] = useState(false);
  const [choreoMirror, setChoreoMirror] = useState(false);
  const choreoCanvasRef = useRef<HTMLCanvasElement>(null);

  // VSL 21 Cards Filter & Practice & Quiz state
  const [acadCat, setAcadCat] = useState<'all' | 'phrases' | 'alphabet' | 'numbers' | 'medical'>('all');
  const [acadSearch, setAcadSearch] = useState('');
  const [completedIds, setCompletedIds] = useState<Record<string, boolean>>({
    PHRASE_LAN: true,
    VSL_HELLO: true,
    VSL_A: true,
  });

  // Practice Modal + Camera Scoring state
  const [practiceLesson, setPracticeLesson] = useState<VslLessonItem | null>(null);
  const [practiceCamOn, setPracticeCamOn] = useState(false);
  const [practiceScore, setPracticeScore] = useState(0);
  const practiceVideoRef = useRef<HTMLVideoElement>(null);
  const practiceCanvasRef = useRef<HTMLCanvasElement>(null);
  const practiceStreamRef = useRef<MediaStream | null>(null);
  const practiceLandmarkerRef = useRef<HandLandmarkerLike | null>(null);
  const practiceRafRef = useRef<number | null>(null);

  // YouTube & Video Library (SignLensVideosDB) state
  const [ytLessons, setYtLessons] = useState<SignVideoLesson[]>([]);
  const [loadingYt, setLoadingYt] = useState(true);
  const [ytCatFilter, setYtCatFilter] = useState('all');
  const [ytSearch, setYtSearch] = useState('');
  const [activeYtLesson, setActiveYtLesson] = useState<SignVideoLesson | null>(null);
  const [confirmDeleteYtId, setConfirmDeleteYtId] = useState<string | null>(null);
  const [embedBlockedHint, setEmbedBlockedHint] = useState(false);
  const [showAddYtModal, setShowAddYtModal] = useState(false);
  const [addSourceType, setAddSourceType] = useState<'youtube' | 'upload'>('youtube');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('chào_hỏi');
  const [newLang, setNewLang] = useState('VSL');
  const [newDifficulty, setNewDifficulty] = useState('cơ_bản');
  const [newDescription, setNewDescription] = useState('');
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('');
  const [uploadedBlobUrl, setUploadedBlobUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState(0);
  const [savingYt, setSavingYt] = useState(false);

  const loadYtLessons = useCallback(async () => {
    setLoadingYt(true);
    try {
      const items = await getAllVideoLessons();
      setYtLessons(items);
    } catch {
      onToast('error', 'Không thể đọc kho video từ IndexedDB.');
    } finally {
      setLoadingYt(false);
    }
  }, [onToast]);

  useEffect(() => {
    loadYtLessons();
  }, [loadYtLessons]);

  // Choreographer Canvas Loop
  useEffect(() => {
    if (sectionTab !== 'choreo') return;
    let rafId = 0;
    let lastSwitch = performance.now();

    const render = (now: number) => {
      const canvas = choreoCanvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          canvas.width = Math.round(rect.width * 2);
          canvas.height = Math.round(rect.height * 2);
        }
        const course = VSL_CHOREO_COURSES[choreoCourseIdx];
        const duration = choreoSlow ? 3400 : 2100;
        if (!choreoPaused && now - lastSwitch > duration) {
          lastSwitch = now;
          setChoreoStepIdx((prev) => (prev + 1) % course.steps.length);
        }
        const step = course.steps[choreoStepIdx] || course.steps[0];
        const speed = choreoSlow ? 0.0022 : 0.0045;
        const t = choreoPaused ? 0.3 : Math.sin(now * speed);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderArticulatedHandCanvas(
            ctx,
            canvas.width || 600,
            canvas.height || 400,
            step,
            t,
            choreoMirror,
            theme === 'dark'
          );
        }
      }
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [sectionTab, choreoCourseIdx, choreoStepIdx, choreoPaused, choreoSlow, choreoMirror, theme]);

  // Stop practice camera cleanly
  const stopPracticeCamera = useCallback(() => {
    if (practiceRafRef.current) cancelAnimationFrame(practiceRafRef.current);
    practiceRafRef.current = null;
    if (practiceStreamRef.current) {
      practiceStreamRef.current.getTracks().forEach((t) => t.stop());
      practiceStreamRef.current = null;
    }
    setPracticeCamOn(false);
  }, []);

  useEffect(() => {
    return () => stopPracticeCamera();
  }, [stopPracticeCamera]);

  const startPracticeCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onToast('warning', 'Trình duyệt không hỗ trợ Camera.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      practiceStreamRef.current = stream;
      if (practiceVideoRef.current) {
        practiceVideoRef.current.srcObject = stream;
        await practiceVideoRef.current.play();
      }
      setPracticeCamOn(true);

      if (!practiceLandmarkerRef.current) {
        try {
          const mp = await import('@mediapipe/tasks-vision');
          const vision = await mp.FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
          );
          practiceLandmarkerRef.current = (await mp.HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
          })) as unknown as HandLandmarkerLike;
        } catch {
          // ignore load error
        }
      }

      let lastTime = -1;
      const loop = (now: number) => {
        const video = practiceVideoRef.current;
        const canvas = practiceCanvasRef.current;
        if (!practiceStreamRef.current || !video || !canvas) return;
        if (video.readyState >= 2) {
          canvas.width = video.videoWidth || 480;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          if (practiceLandmarkerRef.current && video.currentTime !== lastTime) {
            lastTime = video.currentTime;
            try {
              const res = practiceLandmarkerRef.current.detectForVideo(video, now);
              const hands = res?.landmarks || [];
              if (hands.length > 0) {
                const lm = hands[0];
                const score = Math.min(
                  96,
                  58 + Math.round(Math.abs(lm[8].y - lm[0].y) * 90)
                );
                setPracticeScore(score);
              }
            } catch {
              // ignore frame error
            }
          }
        }
        practiceRafRef.current = requestAnimationFrame(loop);
      };
      practiceRafRef.current = requestAnimationFrame(loop);
    } catch {
      onToast('warning', 'Chưa cấp quyền Camera trên trình duyệt.');
    }
  };

  // YouTube Save Helper
  const parsedNewYtId = extractYouTubeId(newYoutubeUrl);

  const handleSaveYtLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) {
      onToast('warning', 'Vui lòng nhập tên bài học ký hiệu.');
      return;
    }
    if (addSourceType === 'youtube' && !parsedNewYtId) {
      onToast('warning', 'Đường dẫn YouTube chưa hợp lệ (watch, youtu.be hoặc shorts).');
      return;
    }
    if (addSourceType === 'upload' && !uploadedBlobUrl) {
      onToast('warning', 'Vui lòng chọn tệp video từ máy tính.');
      return;
    }

    setSavingYt(true);
    try {
      const lesson: SignVideoLesson = {
        id: `vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        category: newCategory,
        lang: newLang,
        difficulty: newDifficulty,
        description: newDescription.trim(),
        videoType: addSourceType,
        youtubeId: addSourceType === 'youtube' ? parsedNewYtId || '' : '',
        youtubeUrl: addSourceType === 'youtube' ? newYoutubeUrl.trim() : '',
        fileName: addSourceType === 'upload' ? uploadedFileName : '',
        fileSize: addSourceType === 'upload' ? uploadedFileSize : 0,
        videoData: addSourceType === 'upload' ? uploadedBlobUrl : '',
        createdAt: new Date().toISOString(),
      };
      await saveVideoLesson(lesson);
      await loadYtLessons();
      setShowAddYtModal(false);
      setNewName('');
      setNewDescription('');
      setNewYoutubeUrl('');
      setUploadedBlobUrl('');
      onToast('success', `Đã thêm bài học "${cleanName}" vào kho YouTube & Video!`);
    } catch {
      onToast('error', 'Không thể lưu bài học vào IndexedDB.');
    } finally {
      setSavingYt(false);
    }
  };

  const activeCourse = VSL_CHOREO_COURSES[choreoCourseIdx];
  const activeStep = activeCourse.steps[choreoStepIdx] || activeCourse.steps[0];

  const filteredVslCards = VSL_LESSONS_DATA.filter((item) => {
    const matchCat = acadCat === 'all' || item.category === acadCat;
    const q = acadSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.instruction.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const filteredYtLessons = ytLessons.filter((item) => {
    const matchCat = ytCatFilter === 'all' || item.category === ytCatFilter;
    const q = ytSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-10 space-y-4 sm:space-y-6">
      {/* Top Mode Switcher: 2D Animated Choreographer & 21 VSL Cards vs YouTube Video Library */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="grid grid-cols-2 sm:inline-flex items-center p-1 sm:p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSectionTab('choreo')}
            className={`min-h-[40px] sm:min-h-0 px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-colors whitespace-nowrap truncate ${
              sectionTab === 'choreo'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="sm:hidden">🎬 Học VSL 2D</span>
            <span className="hidden sm:inline">🎬 Học Chuyển Động 2D &amp; Bảng Chữ Cái VSL</span>
          </button>
          <button
            type="button"
            onClick={() => setSectionTab('youtube')}
            className={`min-h-[40px] sm:min-h-0 px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-colors whitespace-nowrap truncate ${
              sectionTab === 'youtube'
                ? 'bg-sky-500 text-white dark:text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="sm:hidden">📺 Video YouTube ({ytLessons.length})</span>
            <span className="hidden sm:inline">📺 Kho Video YouTube ({ytLessons.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowAddYtModal(true)}
          className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold shadow-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm bài học / Link YouTube</span>
        </button>
      </div>

      {/* SECTION A: SIGNLENS AI CHOREOGRAPHER + 21 VSL CARDS */}
      {sectionTab === 'choreo' ? (
        <>
          <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-7 border-emerald-500/30 shadow-2xl space-y-4 sm:space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200 dark:border-slate-800 pb-3.5 sm:pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-700 dark:text-emerald-300 text-[11px] sm:text-xs font-bold mb-1.5">
                  <span>🎬</span> Mô Phỏng Bàn Tay &amp; Ghép Cụm Câu VSL
                </div>
                <h1 className="text-lg sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                  Học Cụm Câu Giao Tiếp &amp; Chữ Cái VSL
                </h1>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
              {/* Playlist (4 Cols, order-2 on mobile so 2D stage appears immediately at top) */}
              <div className="order-2 lg:order-1 lg:col-span-4 bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="text-xs font-extrabold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                    1. Chọn cụm câu giao tiếp dài:
                  </div>
                  <div className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                    {VSL_CHOREO_COURSES.map((c, idx) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setChoreoCourseIdx(idx);
                          setChoreoStepIdx(0);
                        }}
                        className={`min-w-[200px] lg:min-w-0 lg:w-full text-left p-3 rounded-xl border transition-all cursor-pointer shrink-0 ${
                          idx === choreoCourseIdx
                            ? 'bg-emerald-500/20 border-emerald-400 text-slate-900 dark:text-white'
                            : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            idx === choreoCourseIdx
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {c.category} • {c.steps.length} nhịp
                        </div>
                        <div className="text-xs font-extrabold mt-0.5 line-clamp-2">{c.title}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hidden lg:block bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs space-y-1">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                    💡 Mẹo học nhanh:
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    Bấm vào từng từ trong thanh nhịp để dừng và luyện kỹ từng động tác tay!
                  </p>
                </div>
              </div>

              {/* 2D Hand Canvas Stage (5 Cols, order-1 on mobile for instant visual focus) */}
              <div className="order-1 lg:order-2 lg:col-span-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between relative">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold">
                    Nhịp {choreoStepIdx + 1}/{activeCourse.steps.length}: {activeStep.word}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setChoreoPaused((p) => !p)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                    >
                      {choreoPaused ? '▶️ Tiếp tục' : '⏸️ Tạm dừng'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChoreoSlow((s) => !s)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                        choreoSlow
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      🐢 0.5x
                    </button>
                    <button
                      type="button"
                      onClick={() => setChoreoMirror((m) => !m)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                        choreoMirror
                          ? 'bg-sky-500 text-slate-950 border-sky-400'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-sky-700 dark:text-sky-300'
                      }`}
                    >
                      🪞 Gương
                    </button>
                  </div>
                </div>

                <div className="relative h-64 rounded-xl bg-slate-900 border border-slate-800/90 overflow-hidden flex items-center justify-center">
                  <canvas ref={choreoCanvasRef} className="w-full h-full" />
                  <div className="absolute bottom-2.5 left-3 right-3 bg-slate-950/90 border border-sky-500/30 rounded-xl px-3 py-2 text-center">
                    <div className="text-xs font-bold text-white">{activeStep.desc}</div>
                  </div>
                </div>

                <div className="pt-3 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Nhịp ghép thành cả câu:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeCourse.steps.map((st, sIdx) => (
                      <button
                        key={st.word + sIdx}
                        type="button"
                        onClick={() => setChoreoStepIdx(sIdx)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          sIdx === choreoStepIdx
                            ? 'bg-sky-500 text-slate-950 border-sky-300 shadow-md'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {sIdx + 1}. {st.word}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step Breakdown Sidebar (3 Cols) */}
              <div className="order-3 lg:col-span-3 bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-3">
                <div className="space-y-3">
                  <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Chi tiết động tác
                  </div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                    {activeCourse.title}
                  </h2>
                  <div className="space-y-2 text-xs">
                    {activeCourse.steps.map((st, sIdx) => (
                      <button
                        key={st.word + sIdx}
                        type="button"
                        onClick={() => setChoreoStepIdx(sIdx)}
                        className={`w-full text-left p-2 rounded-xl border cursor-pointer transition-all ${
                          sIdx === choreoStepIdx
                            ? 'bg-sky-500/15 border-sky-500/40 text-slate-900 dark:text-white'
                            : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {sIdx + 1}. {st.word}:
                        </span>{' '}
                        {st.desc}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => speakVietnameseText(activeCourse.title.replace(/"/g, ''))}
                    className="w-full min-h-[42px] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🔊</span> Nghe phát âm tiếng Việt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPracticeLesson(VSL_LESSONS_DATA[0]);
                      setPracticeScore(0);
                    }}
                    className="w-full min-h-[42px] py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-slate-950 text-xs font-extrabold shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>📸</span> Bật Camera Luyện Tập
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar for 21 VSL Cards */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 sm:gap-3 pt-1">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:flex-wrap">
              {(
                [
                  { id: 'all', label: 'Tất cả bài học' },
                  { id: 'phrases', label: '💬 Cụm Câu' },
                  { id: 'alphabet', label: '🔤 Chữ Cái VSL' },
                  { id: 'numbers', label: '🔢 Số Đếm' },
                  { id: 'medical', label: '🏥 Y Tế' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setAcadCat(cat.id)}
                  className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    acadCat === cat.id
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 font-semibold'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={acadSearch}
              onChange={(e) => setAcadSearch(e.target.value)}
              placeholder="🔍 Tìm chữ cái (Ă, Đ, Ư...) hoặc cụm câu..."
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 h-10 sm:h-auto sm:py-2 text-xs text-slate-900 dark:text-white w-full sm:w-80 focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* 21 VSL Lessons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVslCards.map((lesson) => {
              const isDone = Boolean(completedIds[lesson.id]);
              return (
                <div
                  key={lesson.id}
                  className="glass-card rounded-3xl p-4 flex flex-col justify-between gap-3 hover:border-emerald-400/50 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-sky-700 dark:text-sky-300 border border-slate-200 dark:border-slate-800">
                        {lesson.catLabel}
                      </span>
                      {isDone ? (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          ✓ Đã thuộc
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">Chưa học</span>
                      )}
                    </div>

                    <div className="h-40 rounded-2xl bg-slate-950/95 border border-slate-800/90 flex items-center justify-center p-2 mb-3 group-hover:scale-[1.02] transition-transform">
                      <HandLessonSvg type={lesson.svgKey} />
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
                      {lesson.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                      {lesson.instruction}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPracticeLesson(lesson);
                        setPracticeScore(0);
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition-all cursor-pointer"
                    >
                      📸 Học &amp; Thực hành AI
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        speakVietnameseText(lesson.title.replace(/\(.*?\)/g, '').replace(/"/g, ''))
                      }
                      aria-label={`Nghe ${lesson.title}`}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300 text-xs border border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                      🔊
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* SECTION B: YOUTUBE & LOCAL VIDEO LIBRARY */
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Kho Bài Học Video &amp; Liên Kết YouTube (VSL)
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Dán link YouTube bài học mới hoặc tải video MP4/WebM để lưu vĩnh viễn trong thư viện học tập.
              </p>
            </div>
            <div className="relative w-full lg:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ytSearch}
                onChange={(e) => setYtSearch(e.target.value)}
                placeholder="Tìm video bài học..."
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:flex-wrap">
            {YT_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setYtCatFilter(c.key)}
                className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                  ytCatFilter === c.key
                    ? 'bg-sky-500 text-white dark:text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {loadingYt ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-72 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 animate-pulse"
                />
              ))}
            </div>
          ) : filteredYtLessons.length === 0 ? (
            <div className="glass-card rounded-3xl p-10 text-center">
              <Film className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Chưa có bài học phù hợp
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Bấm nút "Thêm bài học / Link YouTube" ở góc phải để thêm video mới.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredYtLessons.map((lesson) => {
                const isYt = lesson.videoType === 'youtube' || Boolean(lesson.youtubeId);
                return (
                  <article
                    key={lesson.id}
                    onClick={() => {
                      setActiveYtLesson(lesson);
                      setEmbedBlockedHint(false);
                      setConfirmDeleteYtId(null);
                    }}
                    className="glass-card rounded-3xl overflow-hidden hover:border-sky-400/60 transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="relative aspect-video bg-slate-900 overflow-hidden">
                        {isYt && lesson.youtubeId ? (
                          <img
                            src={getYouTubeThumbnailUrl(lesson.youtubeId)}
                            alt={lesson.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                          />
                        ) : lesson.videoData ? (
                          <video src={lesson.videoData} muted preload="metadata" className="w-full h-full object-cover" />
                        ) : null}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent flex items-end justify-between p-3">
                          <span className="text-xs font-semibold text-white">
                            {isYt ? 'YouTube Video' : 'Video tải lên'}
                          </span>
                          <span className="w-8 h-8 rounded-full bg-white/90 text-slate-900 inline-flex items-center justify-center">
                            <Play className="w-4 h-4 ml-0.5" />
                          </span>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                          <span>{lesson.category.replace('_', ' ')}</span>
                          <span>·</span>
                          <span>{lesson.lang}</span>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                          {lesson.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {lesson.description || 'Xem video hướng dẫn động tác chuẩn.'}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: VSL PRACTICE MODAL */}
      {practiceLesson && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl max-w-3xl w-full p-5 sm:p-6 border-sky-500/40 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  {practiceLesson.catLabel}
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  {practiceLesson.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopPracticeCamera();
                  setPracticeLesson(null);
                }}
                className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-700 dark:text-white flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="h-52 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center p-4">
                  <HandLessonSvg type={practiceLesson.svgKey} />
                </div>
                <div className="bg-slate-100 dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="font-bold text-emerald-700 dark:text-emerald-400">
                    📋 Cách thực hiện chuẩn VSL:
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                    {practiceLesson.instruction}
                  </p>
                  <div className="font-bold text-amber-600 dark:text-amber-400 pt-1">
                    ⚠️ Lưu ý chuẩn xác:
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {practiceLesson.tip}
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-between bg-slate-100 dark:bg-slate-950 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-700 dark:text-sky-300">
                    📸 Thực hành trước Camera AI
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      practiceScore >= 88
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {practiceScore >= 88
                      ? '🎉 Chính xác xuất sắc!'
                      : practiceCamOn
                        ? 'Đang căn chỉnh ngón tay...'
                        : 'Đang chờ tay...'}
                  </span>
                </div>

                <div className="relative h-48 rounded-xl bg-slate-900 overflow-hidden border border-slate-800 flex items-center justify-center">
                  <video ref={practiceVideoRef} autoPlay playsInline muted className="hidden" />
                  <canvas ref={practiceCanvasRef} className="w-full h-full object-cover mirror-view" />
                  {!practiceCamOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-slate-950/80">
                      <p className="text-xs text-slate-300 mb-2">
                        Bật Camera để AI chấm điểm tư thế ngón tay của bạn
                      </p>
                      <button
                        type="button"
                        onClick={startPracticeCamera}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold cursor-pointer"
                      >
                        📹 Bật Camera Ngay
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">Độ chính xác ký hiệu VSL:</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                      {practiceScore}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-200"
                      style={{ width: `${practiceScore}%` }}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      speakVietnameseText(practiceLesson.title.replace(/\(.*?\)/g, '').replace(/"/g, ''))
                    }
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                  >
                    🔊 Nghe tiếng Việt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCompletedIds((prev) => ({ ...prev, [practiceLesson.id]: true }));
                      onToast('success', `Đã hoàn thành bài học "${practiceLesson.title}"!`);
                      stopPracticeCamera();
                      setPracticeLesson(null);
                    }}
                    className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold cursor-pointer"
                  >
                    ✓ Đánh dấu đã thuộc
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD YOUTUBE LINK OR UPLOAD VIDEO */}
      {showAddYtModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Thêm bài học Video / Link YouTube
              </h2>
              <button
                type="button"
                onClick={() => setShowAddYtModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setAddSourceType('youtube')}
                className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  addSourceType === 'youtube'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Dán Link YouTube
              </button>
              <button
                type="button"
                onClick={() => setAddSourceType('upload')}
                className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  addSourceType === 'upload'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Tải lên tệp Video
              </button>
            </div>

            <form onSubmit={handleSaveYtLesson} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên ký hiệu / Bài học
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ví dụ: Xin lỗi, Chào buổi sáng..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                >
                  {YT_CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={newLang}
                  onChange={(e) => setNewLang(e.target.value)}
                  className="h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                >
                  <option value="VSL">VSL</option>
                  <option value="ASL">ASL</option>
                </select>
                <select
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(e.target.value)}
                  className="h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                >
                  <option value="cơ_bản">Cơ bản</option>
                  <option value="trung_bình">Trung bình</option>
                  <option value="nâng_cao">Nâng cao</option>
                </select>
              </div>

              {addSourceType === 'youtube' ? (
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={newYoutubeUrl}
                    onChange={(e) => setNewYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... hoặc https://youtu.be/..."
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                  {newYoutubeUrl.trim() && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                      {parsedNewYtId ? (
                        <div className="flex items-center gap-3">
                          <img
                            src={getYouTubeThumbnailUrl(parsedNewYtId)}
                            alt="Xem trước"
                            referrerPolicy="no-referrer"
                            className="w-24 h-16 rounded-lg object-cover bg-black shrink-0"
                          />
                          <div className="text-xs min-w-0">
                            <p className="font-bold text-emerald-600 dark:text-emerald-400">
                              Mã video: <span className="font-mono-code">{parsedNewYtId}</span>
                            </p>
                            <p className="text-slate-500 truncate">
                              {getYouTubeWatchUrl(parsedNewYtId)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-rose-500">
                          Chưa tách được mã YouTube hợp lệ từ đường dẫn này.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer hover:border-sky-500">
                  <Upload className="w-6 h-6 text-sky-500 mb-2" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {uploadedFileName || 'Chọn video MP4 hoặc WebM (tối đa 50MB)'}
                  </span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 50 * 1024 * 1024) {
                        onToast('warning', 'Dung lượng video tối đa 50MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setUploadedBlobUrl(String(ev.target?.result || ''));
                        setUploadedFileName(file.name);
                        setUploadedFileSize(file.size);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}

              <textarea
                rows={3}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Hướng dẫn chi tiết cách đặt bàn tay và di chuyển..."
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
              />

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddYtModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingYt}
                  className="h-10 px-5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold cursor-pointer"
                >
                  {savingYt ? 'Đang lưu...' : 'Lưu bài học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: YOUTUBE & VIDEO PLAYER */}
      {activeYtLesson && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                  {activeYtLesson.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeYtLesson.category.replace('_', ' ')} · {activeYtLesson.lang}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveYtLesson(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black aspect-video w-full">
              {activeYtLesson.youtubeId ? (
                <iframe
                  title={activeYtLesson.name}
                  src={getYouTubeEmbedUrl(activeYtLesson.youtubeId)}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  onError={() => setEmbedBlockedHint(true)}
                />
              ) : activeYtLesson.videoData ? (
                <video src={activeYtLesson.videoData} controls autoPlay className="w-full h-full" />
              ) : null}
            </div>

            <div className="p-5 space-y-4">
              {activeYtLesson.youtubeId && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs">
                  <span className="text-slate-600 dark:text-slate-300">
                    {embedBlockedHint
                      ? 'Video này hạn chế nhúng trong trình duyệt.'
                      : 'Nếu video YouTube không phát được trực tiếp trong khung:'}
                  </span>
                  <a
                    href={getYouTubeWatchUrl(activeYtLesson.youtubeId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-bold text-sky-600 dark:text-sky-400 hover:underline shrink-0"
                  >
                    <span>Mở trực tiếp trên YouTube</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                {activeYtLesson.description || 'Chưa có mô tả chi tiết cho bài học này.'}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => speakVietnameseText(activeYtLesson.name)}
                  className="h-9 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <SpeakerSvg className="w-4 h-4" />
                  <span>Nghe tên ký hiệu</span>
                </button>

                {confirmDeleteYtId !== activeYtLesson.id ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteYtId(activeYtLesson.id)}
                    className="h-9 px-3.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa bài học</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteYtId(null)}
                      className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs cursor-pointer"
                    >
                      Giữ lại
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteVideoLesson(activeYtLesson.id);
                        setActiveYtLesson(null);
                        setConfirmDeleteYtId(null);
                        await loadYtLessons();
                        onToast('info', 'Đã xóa bài học khỏi kho video.');
                      }}
                      className="h-8 px-3 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Xác nhận xóa
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
