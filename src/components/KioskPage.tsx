import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { LandmarkPoint, ThemeMode } from '../types/signlens';
import {
  DemoWaveDetector,
  StudioModelTrainer,
  drawHandSkeleton,
  speakVietnameseText,
} from '../utils/gestureEngine';
import {
  buildAiSignQueueFromVietnamese,
  renderArticulatedHandCanvas,
  type AiSignStep,
} from '../utils/vslChoreographer';

interface KioskPageProps {
  theme: ThemeMode;
  onToast: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
}

type KioskCtxKey = 'hospital' | 'bank' | 'shop' | 'way';

const KIOSK_CONTEXT_DATA: Record<KioskCtxKey, Array<{ label: string; text: string }>> = {
  hospital: [
    {
      label: '🩺 Đăng ký khám BHYT',
      text: 'Xin chào, tôi là người khiếm thính. Tôi muốn đăng ký khám bệnh bằng Bảo hiểm Y tế.',
    },
    {
      label: '💊 Hỏi cách uống thuốc',
      text: 'Nhờ dược sĩ ghi rõ giúp tôi thuốc này uống trước hay sau bữa ăn, ngày mấy lần?',
    },
    {
      label: '⚠️ Báo dị ứng thuốc',
      text: 'Lưu ý: Tôi có tiền sử dị ứng thuốc kháng sinh, nhờ bác sĩ kiểm tra kỹ đơn thuốc.',
    },
  ],
  bank: [
    {
      label: '💳 Mở thẻ / Rút tiền',
      text: 'Xin chào, tôi là người khiếm thính. Tôi cần hỗ trợ rút tiền mặt và cập nhật sinh trắc học.',
    },
    {
      label: '🪪 Giấy tờ hành chính',
      text: 'Tôi mang theo Căn cước công dân gắn chip. Nhờ nhân viên hướng dẫn các bước ký tên.',
    },
    {
      label: '🔢 Lấy số ưu tiên',
      text: 'Cho tôi xin số thứ tự giao dịch ở quầy hỗ trợ ưu tiên.',
    },
  ],
  shop: [
    {
      label: '🧾 Thanh toán chuyển khoản',
      text: 'Tôi muốn thanh toán toàn bộ đơn hàng này bằng mã QR ngân hàng.',
    },
    {
      label: '🔍 Hỏi tìm gian hàng',
      text: 'Cho tôi hỏi quầy bán thực phẩm thiết yếu và nước uống nằm ở dãy nào?',
    },
    {
      label: '🛍️ Kiểm tra giá tiền',
      text: 'Nhờ nhân viên kiểm tra giúp tôi tổng số tiền của các sản phẩm này.',
    },
  ],
  way: [
    {
      label: '🚌 Hỏi đường ra bến xe',
      text: 'Làm ơn chỉ giúp tôi đường đi bộ ra trạm xe buýt hoặc ga tàu gần nhất.',
    },
    {
      label: '🚕 Xác nhận điểm đón',
      text: 'Tôi đang đứng chờ ngay trước cổng chính, nhờ tài xế tới đúng vị trí giúp tôi.',
    },
    {
      label: '🏥 Tìm bệnh viện gần nhất',
      text: 'Xin hỏi bệnh viện hoặc nhà thuốc gần đây nhất đi theo hướng nào ạ?',
    },
  ],
};

interface HandLandmarkerLike {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => { landmarks?: LandmarkPoint[][] };
}

interface SpeechRecLike {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function KioskPage({ theme, onToast }: KioskPageProps) {
  const [isTopFlipped, setIsTopFlipped] = useState(false);
  const [deafToHearingText, setDeafToHearingText] = useState(
    'Xin chào! Tôi là người khiếm thính. Tôi cần khám đau đầu và kiểm tra huyết áp.'
  );
  const [hearingToDeafText, setHearingToDeafText] = useState(
    'Mời bạn ngồi xuống ghế số 2, bác sĩ sẽ đo huyết áp cho bạn ngay nhé!'
  );
  const [deafComposeInput, setDeafComposeInput] = useState('');
  const [manualReplyInput, setManualReplyInput] = useState('');
  const [ctxKey, setCtxKey] = useState<KioskCtxKey>('hospital');

  // Camera & MediaPipe state
  const [camOn, setCamOn] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);

  // Corner AI Sign Interpreter state
  const [aiQueue, setAiQueue] = useState<AiSignStep[]>(() =>
    buildAiSignQueueFromVietnamese(
      'Mời bạn ngồi xuống ghế số 2, bác sĩ sẽ đo huyết áp cho bạn ngay nhé!'
    )
  );
  const [aiStepIdx, setAiStepIdx] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarkerLike | null>(null);
  const camRafRef = useRef<number | null>(null);
  const waveDetectorRef = useRef(new DemoWaveDetector());

  const sendKioskPhrase = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      setDeafToHearingText(clean);
      speakVietnameseText(clean);
      onToast('success', 'Đã hiển thị chữ lớn & phát loa tiếng Việt!');
    },
    [onToast]
  );

  // Animate Corner AI Sign Language Interpreter PiP
  useEffect(() => {
    let rafId = 0;
    let lastSwitch = performance.now();

    const renderAi = (now: number) => {
      const canvas = aiCanvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          canvas.width = Math.round(rect.width * 2);
          canvas.height = Math.round(rect.height * 2);
        }
        if (aiQueue.length > 0 && now - lastSwitch > 1500) {
          lastSwitch = now;
          setAiStepIdx((prev) => (prev + 1) % aiQueue.length);
        }
        const ctx = canvas.getContext('2d');
        const step = aiQueue[aiStepIdx % Math.max(1, aiQueue.length)] || {
          word: 'XIN CHÀO',
          pose: 'wave',
          arrow: 'right_arc',
        };
        if (ctx) {
          renderArticulatedHandCanvas(
            ctx,
            canvas.width || 300,
            canvas.height || 200,
            step,
            Math.sin(now * 0.005),
            false,
            theme === 'dark'
          );
        }
      }
      rafId = requestAnimationFrame(renderAi);
    };

    rafId = requestAnimationFrame(renderAi);
    return () => cancelAnimationFrame(rafId);
  }, [aiQueue, aiStepIdx, theme]);

  // Stop webcam on unmount
  useEffect(() => {
    return () => {
      if (camRafRef.current) cancelAnimationFrame(camRafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const toggleKioskCamera = async () => {
    if (camOn) {
      if (camRafRef.current) cancelAnimationFrame(camRafRef.current);
      camRafRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setCamOn(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      onToast('warning', 'Trình duyệt không hỗ trợ Camera.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
      onToast('success', 'Đã bật Camera nhận diện ký hiệu tay trong Giao tiếp 1 Máy!');

      if (!landmarkerRef.current) {
        try {
          const mp = await import('@mediapipe/tasks-vision');
          const vision = await mp.FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
          );
          landmarkerRef.current = (await mp.HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
          })) as unknown as HandLandmarkerLike;
        } catch {
          // Non-fatal fallback
        }
      }

      let lastVidTime = -1;
      const loop = (now: number) => {
        const videoEl = videoRef.current;
        const canvasEl = canvasRef.current;
        if (!streamRef.current || !videoEl || !canvasEl) return;

        if (videoEl.readyState >= 2) {
          canvasEl.width = videoEl.videoWidth || 480;
          canvasEl.height = videoEl.videoHeight || 360;
          const ctx = canvasEl.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

          if (landmarkerRef.current && videoEl.currentTime !== lastVidTime) {
            lastVidTime = videoEl.currentTime;
            try {
              const res = landmarkerRef.current.detectForVideo(videoEl, now);
              const hands = res?.landmarks || [];
              if (hands.length > 0 && ctx) {
                hands.forEach((h) => drawHandSkeleton(ctx, h));
                const trainedMatch = StudioModelTrainer.predict(hands, now, 'VSL');
                if (trainedMatch) {
                  sendKioskPhrase(trainedMatch.sign);
                } else {
                  const waveRes = waveDetectorRef.current.update(hands[0][0].x, now);
                  if (waveRes) {
                    sendKioskPhrase('Xin chào bạn! Tôi là người khiếm thính, rất vui được gặp bạn.');
                  }
                }
              }
            } catch {
              // ignore frame errors
            }
          }
        }
        camRafRef.current = requestAnimationFrame(loop);
      };
      camRafRef.current = requestAnimationFrame(loop);
    } catch {
      onToast('warning', 'Chưa cấp quyền Camera trên trình duyệt.');
    }
  };

  const applyHearingReply = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setHearingToDeafText(clean);
    setAiQueue(buildAiSignQueueFromVietnamese(clean));
    setAiStepIdx(0);
  };

  const startVoiceListener = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecLike;
      webkitSpeechRecognition?: new () => SpeechRecLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      onToast(
        'warning',
        'Trình duyệt không hỗ trợ Speech-to-Text. Người đối diện có thể gõ vào ô bên dưới!'
      );
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'vi-VN';
    rec.interimResults = true;
    rec.onstart = () => setIsListeningVoice(true);
    rec.onresult = (e) => {
      let str = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        str += e.results[i][0].transcript;
      }
      if (str.trim()) {
        applyHearingReply(str);
      }
    };
    rec.onend = () => setIsListeningVoice(false);
    try {
      rec.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  const currentAiStep = aiQueue[aiStepIdx % Math.max(1, aiQueue.length)] || {
    word: 'MỜI BẠN',
    pose: 'wave',
    arrow: 'right_arc',
  };

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-5">
      {/* Top Banner */}
      <div className="glass-card rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border-sky-500/35 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-700 dark:text-sky-300 text-[11px] font-extrabold mb-1">
            <span>🤝</span> Giao tiếp trực diện 1 thiết bị
          </div>
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-snug">
            Giao Tiếp Trực Tiếp 1 Máy
          </h1>
          <p className="hidden sm:block text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            Bạn dùng <strong>Camera làm ký hiệu hoặc gõ chữ</strong> để phát loa tiếng Việt cho người đối diện nghe; đồng thời nhìn <strong>góc nhỏ AI làm ký hiệu</strong> để hiểu người kia đang nói gì.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsTopFlipped((prev) => !prev)}
            className="min-h-[44px] px-3 sm:px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white dark:text-slate-950 text-xs font-extrabold shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>🔄</span>
            <span className="truncate">
              {isTopFlipped ? 'Trả lại chiều' : 'Xoay 180°'}
              <span className="hidden sm:inline">
                {isTopFlipped ? ' bình thường' : ' (Cho người đối diện)'}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={startVoiceListener}
            className="min-h-[44px] px-3 sm:px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-extrabold shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>🎙️</span>
            <span className="truncate">
              {isListeningVoice ? 'Đang nghe...' : 'Nghe người kia nói'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
        {/* Left & Center: Split Screen (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* TOP HALF: FOR HEARING PERSON (Flips 180°) */}
          <div
            className={`glass-card rounded-3xl p-4 sm:p-5 border-2 border-emerald-500/50 bg-gradient-to-b from-emerald-500/10 to-white dark:from-emerald-950/35 dark:to-slate-950/95 transition-transform duration-500 space-y-3 ${
              isTopFlipped ? 'flip-180' : ''
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold border border-emerald-500/40">
                👁️ MÀN HÌNH DÀNH CHO NGƯỜI ĐỐI DIỆN ĐỌC &amp; NGHE
              </span>
              <button
                type="button"
                onClick={() => speakVietnameseText(deafToHearingText)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-extrabold cursor-pointer flex items-center gap-1.5 shadow"
              >
                <span>🔊</span> Đọc tiếng Việt thành tiếng
              </button>
            </div>

            <div className="bg-white dark:bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-4 min-h-[100px] flex flex-col justify-center">
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                Nội dung người khiếm thính gửi tới bạn:
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-snug caption-rise">
                {deafToHearingText}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sky-600 dark:text-sky-300">
              ⇅ Giao tiếp 2 chiều ngay trên 1 thiết bị
            </span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* BOTTOM HALF: FOR DEAF USER */}
          <div className="glass-card rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border-2 border-sky-500/50 bg-gradient-to-t from-sky-500/10 to-white dark:from-sky-950/35 dark:to-slate-950/95 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[11px] font-extrabold border border-sky-500/40">
                🤟 KHU VỰC CỦA BẠN
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleKioskCamera}
                  className="min-h-[40px] sm:min-h-0 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white dark:text-slate-950 text-xs font-extrabold cursor-pointer flex items-center gap-1"
                >
                  <span>📹</span>
                  <span>{camOn ? 'Tắt Camera' : 'Bật Cam Ký Hiệu'}</span>
                </button>
                <span
                  className={`text-[11px] font-bold ${
                    isListeningVoice ? 'text-rose-500 animate-pulse' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isListeningVoice ? '● ĐANG NGHE...' : '● Sẵn sàng'}
                </span>
              </div>
            </div>

            {/* Camera + Corner AI Interpreter */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Sign Camera (7 cols) */}
              <div className="sm:col-span-7 relative h-44 sm:h-52 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover mirror-view ${camOn ? 'block' : 'hidden'}`}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover mirror-view pointer-events-none"
                />
                {!camOn && (
                  <div className="text-center p-3 space-y-1.5 z-10 pb-10">
                    <div className="text-2xl sm:text-3xl">🤟 📷</div>
                    <div className="text-xs font-bold text-white">Camera Nhận Diện Ký Hiệu Tay</div>
                    <p className="text-[10px] text-slate-400 hidden sm:block">
                      Bật camera để vẫy tay / làm ký hiệu gửi nội dung lên màn hình trên
                    </p>
                    <button
                      type="button"
                      onClick={toggleKioskCamera}
                      className="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-400/50 text-sky-300 text-[11px] font-bold cursor-pointer"
                    >
                      Mở Camera ngay
                    </button>
                  </div>
                )}

                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap sm:justify-center z-20">
                  <button
                    type="button"
                    onClick={() => sendKioskPhrase('Xin chào bạn! 👋')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-emerald-500/30 border border-slate-700 text-[10px] font-bold text-emerald-300 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    👋 Xin chào
                  </button>
                  <button
                    type="button"
                    onClick={() => sendKioskPhrase('Cảm ơn bạn rất nhiều! 🙏')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-emerald-500/30 border border-slate-700 text-[10px] font-bold text-emerald-300 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    🙏 Cảm ơn
                  </button>
                  <button
                    type="button"
                    onClick={() => sendKioskPhrase('Xin lỗi, bạn có thể nói chậm lại được không?')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-emerald-500/30 border border-slate-700 text-[10px] font-bold text-sky-300 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    🐢 Nói chậm lại
                  </button>
                </div>
              </div>

              {/* Corner AI Sign Interpreter PiP (5 cols) */}
              <div className="sm:col-span-5 relative h-44 sm:h-52 rounded-2xl bg-gradient-to-b from-indigo-950/90 to-slate-950 border-2 border-indigo-400/50 overflow-hidden flex flex-col justify-between p-2.5 text-white">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/25 border border-indigo-400/40 text-indigo-200 text-[10px] font-extrabold">
                    🤖 AI Phiên Dịch Ký Hiệu
                  </span>
                  <span className="text-[10px] font-bold text-emerald-300">
                    {(aiStepIdx % Math.max(1, aiQueue.length)) + 1}/{aiQueue.length}
                  </span>
                </div>
                <canvas ref={aiCanvasRef} className="w-full h-32" />
                <div className="bg-slate-950/90 border border-indigo-500/30 rounded-lg px-2 py-1 text-center">
                  <div className="text-[11px] font-black text-amber-300 truncate">
                    Ký hiệu: {currentAiStep.word}
                  </div>
                </div>
              </div>
            </div>

            {/* Hearing Person Reply Display */}
            <div className="bg-white dark:bg-slate-950/90 border border-sky-500/30 rounded-2xl p-3.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-sky-700 dark:text-sky-400 font-bold">
                  Lời người đối diện nói (AI dịch thành chữ &amp; ký hiệu ở góc phải):
                </span>
                <button
                  type="button"
                  onClick={() => applyHearingReply(hearingToDeafText)}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer"
                >
                  ↻ AI làm lại ký hiệu
                </button>
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                {hearingToDeafText}
              </div>
            </div>

            {/* Compose Inputs */}
            <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800/80">
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                ✍️ Hoặc nhập đầy đủ nội dung muốn nói với người đối diện (Hiện chữ to &amp; đọc tiếng Việt):
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={deafComposeInput}
                  onChange={(e) => setDeafComposeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && deafComposeInput.trim()) {
                      sendKioskPhrase(deafComposeInput);
                      setDeafComposeInput('');
                    }
                  }}
                  placeholder="Ví dụ: Tôi muốn mua thuốc cảm cúm và thuốc hạ sốt cho người lớn..."
                  className="flex-1 bg-white dark:bg-slate-950 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!deafComposeInput.trim()) return;
                    sendKioskPhrase(deafComposeInput);
                    setDeafComposeInput('');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-extrabold cursor-pointer shrink-0"
                >
                  🔊 Gửi &amp; Đọc Tiếng Việt
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={manualReplyInput}
                  onChange={(e) => setManualReplyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualReplyInput.trim()) {
                      applyHearingReply(manualReplyInput);
                      setManualReplyInput('');
                      onToast('info', 'AI đã dịch lời người đối diện sang ký hiệu minh họa!');
                    }
                  }}
                  placeholder="Ô dành cho người đối diện gõ câu trả lời cho bạn (AI sẽ dịch sang ký hiệu)..."
                  className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!manualReplyInput.trim()) return;
                    applyHearingReply(manualReplyInput);
                    setManualReplyInput('');
                    onToast('info', 'AI đã dịch lời người đối diện sang ký hiệu minh họa!');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white dark:text-slate-950 text-xs font-extrabold cursor-pointer shrink-0"
                >
                  Dịch cho bạn ➔
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Smart Context Boards (5 Cols) */}
        <div className="lg:col-span-5 glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>⚡</span> Bảng Giao Tiếp Nhanh
              </h3>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                1 Chạm + Đọc Tiếng Việt
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              {(
                [
                  { id: 'hospital', label: '🏥 Bệnh viện' },
                  { id: 'bank', label: '🏦 Ngân hàng' },
                  { id: 'shop', label: '🛒 Mua sắm' },
                  { id: 'way', label: '🚌 Hỏi đường' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCtxKey(tab.id)}
                  className={`min-h-[40px] sm:min-h-0 py-2 px-1.5 rounded-lg text-[11px] cursor-pointer transition-colors whitespace-nowrap ${
                    ctxKey === tab.id
                      ? 'bg-sky-500 text-white dark:text-slate-950 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {ctxKey === 'hospital' && (
              <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-2">
                <div className="text-[11px] font-bold text-amber-600 dark:text-amber-300">
                  🩺 Chạm vào vùng cơ thể đang bị đau để báo bác sĩ:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { label: '🤕 Đau Đầu', msg: 'Tôi bị đau đầu, chóng mặt và hơi sốt từ hôm qua.' },
                    { label: '😷 Đau Họng', msg: 'Tôi bị đau họng, ho nhiều và khó nuốt.' },
                    { label: '🫀 Tức Ngực', msg: 'Tôi bị tức ngực và khó thở, nhờ bác sĩ kiểm tra gấp.' },
                    { label: '🤢 Đau Bụng', msg: 'Tôi bị đau bụng dữ dội và buồn nôn.' },
                    { label: '💪 Đau Tay', msg: 'Tôi bị đau nhức xương khớp ở cánh tay.' },
                    { label: '🦵 Đau Chân', msg: 'Tôi bị đau chân và bong gân rất khó đi lại.' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => sendKioskPhrase(item.msg)}
                      className="min-h-[44px] sm:min-h-0 p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-rose-500/20 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {KIOSK_CONTEXT_DATA[ctxKey].map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => sendKioskPhrase(card.text)}
                  className="w-full text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 hover:bg-sky-500/15 border border-slate-200 dark:border-slate-800 hover:border-sky-400/50 transition-all cursor-pointer space-y-1"
                >
                  <div className="text-xs font-extrabold text-sky-700 dark:text-sky-300">
                    {card.label}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {card.text}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-[11px] text-slate-600 dark:text-slate-400">
            💡 Bấm thẻ bất kỳ để hiện chữ lớn ở màn hình trên và phát giọng đọc tiếng Việt rõ ràng.
          </div>
        </div>
      </div>
    </section>
  );
}
