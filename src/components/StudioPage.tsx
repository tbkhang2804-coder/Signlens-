import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { LandmarkPoint, StudioFrameSample, StudioSampleRecord } from '../types/signlens';
import {
  clearAllStudioSamples,
  getAllStudioSamples,
  loadStudioLabels,
  saveStudioLabels,
  saveStudioSample,
} from '../utils/indexedDb';
import { StudioModelTrainer, drawHandSkeleton } from '../utils/gestureEngine';

interface StudioPageProps {
  onStudioTrained: (templateCount: number) => void;
  onOpenAccountAdmin: () => void;
  onToast: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
}

interface HandLandmarkerLike {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => { landmarks?: LandmarkPoint[][] };
}

export default function StudioPage({
  onStudioTrained,
  onOpenAccountAdmin,
  onToast,
}: StudioPageProps) {
  const [labels, setLabels] = useState<string[]>(() => loadStudioLabels());
  const [selectedLabel, setSelectedLabel] = useState<string>(() => loadStudioLabels()[0] || 'XIN_CHAO');
  const [newLabelInput, setNewLabelInput] = useState('');
  const [samples, setSamples] = useState<StudioSampleRecord[]>([]);

  // Live 5-finger telemetry percentages
  const [telemetry, setTelemetry] = useState({
    thumb: 85,
    index: 92,
    middle: 40,
    ring: 20,
    pinky: 95,
  });

  // Camera & Recording state
  const [camOn, setCamOn] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [labPrediction, setLabPrediction] = useState<{ sign: string; conf: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarkerLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const recordStartRef = useRef(0);
  const recordBufferRef = useRef<StudioFrameSample[]>([]);

  const refreshSamples = useCallback(async () => {
    try {
      const list = await getAllStudioSamples();
      setSamples(list);
    } catch {
      // ignore IndexedDB errors
    }
  }, []);

  useEffect(() => {
    refreshSamples();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [refreshSamples]);

  const startStudioCamera = async () => {
    if (camOn) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
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
          onToast('warning', 'Chưa nạp được MediaPipe HandLandmarker.');
        }
      }

      let lastTime = -1;
      const loop = (now: number) => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!streamRef.current || !video || !canvas) return;
        if (video.readyState >= 2) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
          if (landmarkerRef.current && video.currentTime !== lastTime) {
            lastTime = video.currentTime;
            try {
              const res = landmarkerRef.current.detectForVideo(video, now);
              const hands = res?.landmarks || [];
              if (hands.length > 0) {
                const lm = hands[0];
                if (ctx) hands.forEach((h) => drawHandSkeleton(ctx, h));

                const calc = (idx: number) =>
                  Math.min(
                    100,
                    Math.max(12, Math.round(Math.hypot(lm[idx].x - lm[0].x, lm[idx].y - lm[0].y) * 260))
                  );
                setTelemetry({
                  thumb: calc(4),
                  index: calc(8),
                  middle: calc(12),
                  ring: calc(16),
                  pinky: calc(20),
                });

                // Live recognition preview right in the Lab
                const livePred = StudioModelTrainer.predict(hands, now, 'VSL');
                if (livePred) {
                  setLabPrediction({ sign: livePred.sign, conf: Math.round(livePred.confidence * 100) });
                }

                if (isRecordingRef.current) {
                  recordBufferRef.current.push({
                    timestamp: performance.now() - recordStartRef.current,
                    hands: hands.map((h) => h.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z }))),
                  });
                }
              }
            } catch {
              // ignore frame errors
            }
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      onToast('warning', 'Không thể mở Camera trong Phòng Thí Nghiệm AI.');
    }
  };

  const addStudioLabel = () => {
    const val = newLabelInput.trim().toUpperCase().replace(/\s+/g, '_');
    if (!val) return;
    if (!labels.includes(val)) {
      const next = [val, ...labels];
      setLabels(next);
      saveStudioLabels(next);
    }
    setSelectedLabel(val);
    setNewLabelInput('');
  };

  const startRecording = async () => {
    if (!camOn) {
      onToast('warning', 'Hãy bật Camera Phòng Thí Nghiệm trước khi ghi mẫu mới!');
      return;
    }
    for (let c = 3; c >= 1; c--) {
      setCountdownNum(c);
      await new Promise((r) => setTimeout(r, 550));
    }
    setCountdownNum(null);

    recordBufferRef.current = [];
    recordStartRef.current = performance.now();
    isRecordingRef.current = true;
    setIsRecording(true);
    setRecordProgress(0);

    const durationMs = 3000;
    const timer = setInterval(async () => {
      const elapsed = performance.now() - recordStartRef.current;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setRecordProgress(pct);
      if (elapsed >= durationMs) {
        clearInterval(timer);
        isRecordingRef.current = false;
        setIsRecording(false);
        setRecordProgress(0);

        if (recordBufferRef.current.length < 4) {
          onToast('warning', 'Chưa ghi đủ khung hình bàn tay. Giữ tay rõ trước camera và thử lại.');
          return;
        }

        const sample: StudioSampleRecord = {
          id: `samp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label: selectedLabel,
          signLang: 'VSL',
          timestamp: new Date().toISOString(),
          durationMs,
          frameCount: recordBufferRef.current.length,
          sequence: recordBufferRef.current,
          schemaVersion: '1.0',
        };
        await saveStudioSample(sample);
        await refreshSamples();

        // Tự động huấn luyện & đồng bộ tức thì sang cuộc gọi
        const allSamples = await getAllStudioSamples();
        StudioModelTrainer.trainFromSamples(allSamples);
        StudioModelTrainer.saveToStorage();
        onStudioTrained(StudioModelTrainer.templates.length);

        onToast('success', `Đã lưu và đồng bộ mẫu [${selectedLabel}] sẵn sàng cho cuộc gọi!`);
      }
    }, 50);
  };

  const retrainModels = () => {
    StudioModelTrainer.trainFromSamples(samples);
    StudioModelTrainer.saveToStorage();
    onStudioTrained(StudioModelTrainer.templates.length);
    onToast('success', `Đã huấn luyện & đồng bộ ${StudioModelTrainer.templates.length} mẫu VSL vào cuộc gọi!`);
  };

  const exportDatasetJson = async () => {
    const allSamples = await getAllStudioSamples();
    StudioModelTrainer.trainFromSamples(allSamples);
    StudioModelTrainer.saveToStorage();
    onStudioTrained(StudioModelTrainer.templates.length);

    const payload = {
      system: 'SignLens AI VSL Dataset',
      exportedAt: new Date().toISOString(),
      labels,
      samples: allSamples,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signlens_vsl_dataset_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onToast('success', 'Đã xuất Dataset (.JSON) & lưu sẵn sàng cho cuộc gọi video!');
  };

  const handleImportDataset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const importedSamples = Array.isArray(parsed?.samples) ? parsed.samples : [];
        const importedLabels = Array.isArray(parsed?.labels) ? parsed.labels : [];

        if (importedSamples.length === 0) {
          onToast('warning', 'Tệp JSON không chứa danh sách mẫu cử chỉ hợp lệ.');
          return;
        }

        if (importedLabels.length > 0) {
          const merged = Array.from(new Set([...importedLabels, ...labels]));
          setLabels(merged);
          saveStudioLabels(merged);
        }

        for (const s of importedSamples) {
          await saveStudioSample(s);
        }
        await refreshSamples();

        const allSamples = await getAllStudioSamples();
        StudioModelTrainer.trainFromSamples(allSamples);
        StudioModelTrainer.saveToStorage();
        onStudioTrained(StudioModelTrainer.templates.length);

        onToast(
          'success',
          `Đã nạp ${importedSamples.length} mẫu ký hiệu VSL! Dữ liệu đã sẵn sàng cho cuộc gọi video.`
        );
      } catch {
        onToast('error', 'Lỗi khi đọc tệp JSON. Vui lòng kiểm tra định dạng.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const telemetryItems = [
    { name: 'Ngón Cái', val: telemetry.thumb, textCls: 'text-rose-500 dark:text-rose-400', barCls: 'bg-rose-500' },
    { name: 'Ngón Trỏ', val: telemetry.index, textCls: 'text-sky-600 dark:text-sky-400', barCls: 'bg-sky-400' },
    { name: 'Ngón Giữa', val: telemetry.middle, textCls: 'text-emerald-600 dark:text-emerald-400', barCls: 'bg-emerald-400' },
    { name: 'Áp Út', val: telemetry.ring, textCls: 'text-amber-600 dark:text-amber-400', barCls: 'bg-amber-400' },
    { name: 'Ngón Út', val: telemetry.pinky, textCls: 'text-indigo-600 dark:text-indigo-400', barCls: 'bg-indigo-400', colSpan: true },
  ];

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-10 space-y-4 sm:space-y-5">
      {/* Header (Without SOS button) */}
      <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 sm:gap-4 border-indigo-500/30">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-snug">
            Phòng Thí Nghiệm AI — Khớp Tay 3D &amp; Huấn Luyện k-NN
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Đo lường độ duỗi 5 ngón tay thời gian thực từ 21 tọa độ Landmark ngay trong trình duyệt.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAccountAdmin}
          className="w-full sm:w-auto min-h-[42px] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-700 text-white text-xs font-extrabold shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>🛡️</span> Quản Trị Kho Ký Hiệu Máy Chủ
        </button>
      </div>

      {/* 5-Finger Telemetry Grid */}
      <div className="glass-card rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border-sky-500/25">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
          {telemetryItems.map((item) => (
            <div
              key={item.name}
              className={`bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 ${
                item.colSpan ? 'col-span-2 sm:col-span-1' : ''
              }`}
            >
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                <span className={`font-mono-code font-bold ${item.textCls}`}>{item.val}%</span>
              </div>
              <div className="w-full h-2 sm:h-2.5 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.barCls} transition-all`}
                  style={{ width: `${item.val}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3-Column Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Column 1: Labels */}
        <div className="lg:col-span-4 glass-card rounded-2xl sm:rounded-3xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Danh Sách Nhãn Ký Hiệu VSL
            </h2>
            <span className="text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
              {labels.length} nhãn
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newLabelInput}
              onChange={(e) => setNewLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addStudioLabel();
              }}
              placeholder="Thêm nhãn mới (VD: BAC_SI)..."
              className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 min-h-[40px] py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={addStudioLabel}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-extrabold cursor-pointer shrink-0"
            >
              + Thêm
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[210px] sm:max-h-[340px] space-y-1.5 pr-1">
            {labels.map((lbl) => {
              const count = samples.filter((s) => s.label === lbl).length;
              const isSel = lbl === selectedLabel;
              return (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setSelectedLabel(lbl)}
                  className={`w-full min-h-[40px] flex items-center justify-between px-3 py-2 rounded-xl border cursor-pointer text-xs transition-all ${
                    isSel
                      ? 'bg-emerald-500/20 border-emerald-400 text-slate-900 dark:text-white font-bold'
                      : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{lbl}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300">
                    {count} mẫu đã ghi
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 2: 3D Landmark Recorder */}
        <div className="lg:col-span-4 glass-card rounded-2xl sm:rounded-3xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Thu Thập Mẫu 3D Landmark
            </h2>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Nhãn: {selectedLabel}
            </span>
          </div>
          <div className="relative h-[230px] sm:h-[280px] rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="hidden" />
            <canvas ref={canvasRef} className="w-full h-full object-cover mirror-view" />
            {!camOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-center p-4 gap-2">
                <span className="text-3xl">🖐️</span>
                <p className="text-xs text-slate-300">
                  Bật Camera để thu thập mẫu 21 khớp tay cá nhân!
                </p>
                <button
                  type="button"
                  onClick={startStudioCamera}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold cursor-pointer"
                >
                  📹 Bật Camera Studio
                </button>
              </div>
            )}
            {countdownNum !== null && (
              <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
                <span className="text-6xl font-black text-white">{countdownNum}</span>
              </div>
            )}
            {labPrediction && camOn && (
              <div className="absolute top-2 left-2 z-20 px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-black shadow-lg flex items-center gap-1.5 animate-pulse">
                <span>✨</span>
                <span>Test Lab: &quot;{labPrediction.sign}&quot; ({labPrediction.conf}%)</span>
              </div>
            )}
          </div>
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all"
              style={{ width: `${recordProgress}%` }}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startStudioCamera}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer shrink-0"
            >
              {camOn ? 'Tắt Cam' : 'Mở Cam'}
            </button>
            <button
              type="button"
              disabled={isRecording || countdownNum !== null}
              onClick={startRecording}
              className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🔴</span> Ghi Mẫu Mới (3 giây)
            </button>
          </div>
        </div>

        {/* Column 3: Model Telemetry & Export */}
        <div className="lg:col-span-4 glass-card rounded-3xl p-4 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Thông Số Mô Hình AI</h2>
            <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Trạng thái Pre-train:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  Đã kích hoạt VSL 4.0
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Tổng số mẫu vector:</span>
                <span className="font-bold text-sky-700 dark:text-sky-300">
                  {samples.length} mẫu tùy chỉnh ({labels.length * 5 + samples.length} tổng)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Thuật toán phân loại:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-300">
                  IndexedDB + k-NN 3D
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={retrainModels}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white dark:text-slate-950 text-xs font-extrabold shadow-lg cursor-pointer"
            >
              ⚡ Huấn Luyện &amp; Đồng Bộ Vào Cuộc Gọi
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={exportDatasetJson}
                className="py-2.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 cursor-pointer text-center"
              >
                💾 Xuất Dataset (.JSON)
              </button>
              <button
                type="button"
                onClick={() => importFileInputRef.current?.click()}
                className="py-2.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 cursor-pointer text-center"
              >
                📥 Nhập Dataset (.JSON)
              </button>
            </div>
            <input
              type="file"
              ref={importFileInputRef}
              accept=".json"
              className="hidden"
              onChange={handleImportDataset}
            />
            {samples.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await clearAllStudioSamples();
                  await refreshSamples();
                  onToast('info', 'Đã xóa các mẫu thu thập cục bộ.');
                }}
                className="w-full py-2 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold hover:underline cursor-pointer"
              >
                Xóa các mẫu đã ghi ({samples.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
