import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  LogOut,
  Plus,
  Shield,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import type {
  AdminSignRecord,
  AdminUser,
  LandmarkPoint,
  StudioFrameSample,
  StudioSampleRecord,
} from '../types/signlens';
import {
  clearAllStudioSamples,
  getAllStudioSamples,
  loadStudioLabels,
  saveStudioLabels,
  saveStudioSample,
} from '../utils/indexedDb';
import { StudioModelTrainer, drawHandSkeleton } from '../utils/gestureEngine';

interface AccountAdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  adminUser: AdminUser | null;
  adminToken: string | null;
  onAuthChange: (user: AdminUser | null, token: string | null) => void;
  onStudioTrained: (templateCount: number) => void;
  onToast: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
}

interface HandLandmarkerLike {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => { landmarks?: LandmarkPoint[][] };
}

export default function AccountAdminDrawer({
  isOpen,
  onClose,
  adminUser,
  adminToken,
  onAuthChange,
  onStudioTrained,
  onToast,
}: AccountAdminDrawerProps) {
  const [activeTab, setActiveTab] = useState<'studio' | 'admin'>('studio');

  // Auth states
  const [authStatus, setAuthStatus] = useState<'loading' | 'unclaimed' | 'configured'>('loading');
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [confirmSetupPassword, setConfirmSetupPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Admin Signs state
  const [serverSigns, setServerSigns] = useState<AdminSignRecord[]>([]);
  const [newSignLabel, setNewSignLabel] = useState('');
  const [newSignMeaning, setNewSignMeaning] = useState('');
  const [newSignYoutube, setNewSignYoutube] = useState('');

  // Studio Recorder & k-NN Trainer state
  const [labels, setLabels] = useState<string[]>(() => loadStudioLabels());
  const [selectedLabel, setSelectedLabel] = useState<string>(() => loadStudioLabels()[0] || 'XIN_CHAO');
  const [newLabelInput, setNewLabelInput] = useState('');
  const [studioLang, setStudioLang] = useState('VSL');
  const [samples, setSamples] = useState<StudioSampleRecord[]>([]);
  const [studioCamOn, setStudioCamOn] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [confirmClearSamples, setConfirmClearSamples] = useState(false);

  const studioVideoRef = useRef<HTMLVideoElement>(null);
  const studioCanvasRef = useRef<HTMLCanvasElement>(null);
  const studioStreamRef = useRef<MediaStream | null>(null);
  const studioLandmarkerRef = useRef<HandLandmarkerLike | null>(null);
  const studioRafRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const recordStartRef = useRef(0);
  const recordBufferRef = useRef<StudioFrameSample[]>([]);

  const refreshSamples = useCallback(async () => {
    try {
      const list = await getAllStudioSamples();
      setSamples(list);
    } catch {
      // ignore IndexedDB error
    }
  }, []);

  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = (await res.json()) as { source?: string; username?: string };
        setAuthStatus(data.source === 'unclaimed' ? 'unclaimed' : 'configured');
        if (data.username) setLoginUsername(data.username);
      }
    } catch {
      setAuthStatus('configured');
    }
  }, []);

  const fetchAdminSigns = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/admin/signs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { data?: AdminSignRecord[] };
        setServerSigns(data.data || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshSamples();
      fetchAuthStatus();
      if (adminToken) {
        fetchAdminSigns(adminToken);
      }
    }
  }, [adminToken, fetchAdminSigns, fetchAuthStatus, isOpen, refreshSamples]);

  const stopStudioCamera = useCallback(() => {
    if (studioRafRef.current) {
      cancelAnimationFrame(studioRafRef.current);
      studioRafRef.current = null;
    }
    if (studioStreamRef.current) {
      studioStreamRef.current.getTracks().forEach((t) => t.stop());
      studioStreamRef.current = null;
    }
    if (studioVideoRef.current) {
      studioVideoRef.current.srcObject = null;
    }
    setStudioCamOn(false);
  }, []);

  useEffect(() => {
    if (!isOpen) stopStudioCamera();
  }, [isOpen, stopStudioCamera]);

  const startStudioCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onToast('error', 'Trình duyệt không hỗ trợ Camera.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      studioStreamRef.current = stream;
      if (studioVideoRef.current) {
        studioVideoRef.current.srcObject = stream;
        await studioVideoRef.current.play();
      }
      setStudioCamOn(true);

      if (!studioLandmarkerRef.current) {
        try {
          const mp = await import('@mediapipe/tasks-vision');
          const vision = await mp.FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
          );
          studioLandmarkerRef.current = (await mp.HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
          })) as unknown as HandLandmarkerLike;
        } catch {
          onToast('warning', 'Không nạp được MediaPipe trên Studio.');
        }
      }

      let lastTime = -1;
      const loop = () => {
        const video = studioVideoRef.current;
        const canvas = studioCanvasRef.current;
        if (!video || !studioStreamRef.current) return;
        if (video.readyState >= 2 && canvas) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
          }
          const ctx = canvas.getContext('2d');
          if (studioLandmarkerRef.current && video.currentTime !== lastTime) {
            lastTime = video.currentTime;
            const res = studioLandmarkerRef.current.detectForVideo(video, performance.now());
            const hands = res?.landmarks || [];
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              hands.forEach((h) => drawHandSkeleton(ctx, h));
            }
            if (isRecordingRef.current && hands.length > 0) {
              recordBufferRef.current.push({
                timestamp: performance.now() - recordStartRef.current,
                hands: hands.map((h) => h.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z }))),
              });
            }
          }
        }
        studioRafRef.current = requestAnimationFrame(loop);
      };
      studioRafRef.current = requestAnimationFrame(loop);
    } catch {
      onToast('warning', 'Không thể mở Camera trong SignLens Studio.');
    }
  };

  const handleRecordGesture = async () => {
    if (!studioCamOn) {
      onToast('warning', 'Hãy bật Camera Studio trước khi ghi mẫu.');
      return;
    }
    if (!selectedLabel) {
      onToast('warning', 'Vui lòng chọn hoặc tạo một nhãn trước.');
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
    const interval = setInterval(async () => {
      const elapsed = performance.now() - recordStartRef.current;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setRecordProgress(pct);
      if (elapsed >= durationMs) {
        clearInterval(interval);
        isRecordingRef.current = false;
        setIsRecording(false);

        if (recordBufferRef.current.length < 4) {
          onToast('warning', 'Chưa ghi đủ khung hình bàn tay. Giữ tay rõ trước camera và thử lại.');
          return;
        }

        const sample: StudioSampleRecord = {
          id: `samp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label: selectedLabel,
          signLang: studioLang,
          timestamp: new Date().toISOString(),
          durationMs,
          frameCount: recordBufferRef.current.length,
          sequence: recordBufferRef.current,
          schemaVersion: '1.0',
        };
        await saveStudioSample(sample);
        await refreshSamples();
        onToast('success', `Đã lưu mẫu ${selectedLabel} (${sample.frameCount} frame).`);
      }
    }, 50);
  };

  const handleTrainModel = () => {
    const ok = StudioModelTrainer.trainFromSamples(samples);
    if (!ok) {
      onToast('warning', 'Cần tối thiểu 3 mẫu dữ liệu bàn tay để huấn luyện mô hình k-NN.');
      return;
    }
    onStudioTrained(StudioModelTrainer.templates.length);
    onToast(
      'success',
      `Huấn luyện thành công ${StudioModelTrainer.templates.length} mẫu! Bạn có thể chọn "AI Studio" ở trang Giao tiếp.`
    );
  };

  const handleAddLabel = () => {
    const val = newLabelInput.trim().toUpperCase().replace(/\s+/g, '_');
    if (!val) return;
    if (labels.includes(val)) {
      onToast('warning', 'Nhãn này đã tồn tại.');
      return;
    }
    const next = [...labels, val];
    setLabels(next);
    saveStudioLabels(next);
    setSelectedLabel(val);
    setNewLabelInput('');
  };

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginPassword.length < 6) {
      onToast('warning', 'Mật khẩu quản trị cần ít nhất 6 ký tự.');
      return;
    }
    if (loginPassword !== confirmSetupPassword) {
      onToast('warning', 'Mật khẩu xác nhận không khớp.');
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        token?: string;
        user?: AdminUser;
        error?: string;
      };
      if (!res.ok || !data.success || !data.token || !data.user) {
        onToast('error', data.error || 'Thiết lập tài khoản thất bại.');
        return;
      }
      onAuthChange(data.user, data.token);
      setAuthStatus('configured');
      setLoginPassword('');
      setConfirmSetupPassword('');
      onToast('success', 'Đã thiết lập và đăng nhập quản trị viên SignLens.');
    } catch {
      onToast('error', 'Không thể kết nối máy chủ xác thực.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLoginAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        token?: string;
        user?: AdminUser;
        error?: string;
        needsSetup?: boolean;
      };
      if (data.needsSetup) {
        setAuthStatus('unclaimed');
        onToast('info', 'Hãy tạo mật khẩu quản trị ban đầu.');
        return;
      }
      if (!res.ok || !data.success || !data.token || !data.user) {
        onToast('error', data.error || 'Sai thông tin đăng nhập.');
        return;
      }
      onAuthChange(data.user, data.token);
      setLoginPassword('');
      onToast('success', 'Đăng nhập quản trị thành công.');
    } catch {
      onToast('error', 'Lỗi kết nối máy chủ.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleAddServerSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !newSignLabel.trim() || !newSignMeaning.trim()) return;
    try {
      const res = await fetch('/api/admin/signs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          label: newSignLabel.trim(),
          meaning_vi: newSignMeaning.trim(),
          media_url: newSignYoutube.trim(),
          language: 'VSL',
          moderation_status: 'approved',
        }),
      });
      if (res.ok) {
        setNewSignLabel('');
        setNewSignMeaning('');
        setNewSignYoutube('');
        await fetchAdminSigns(adminToken);
        onToast('success', 'Đã thêm mẫu ký hiệu vào máy chủ.');
      }
    } catch {
      onToast('error', 'Không thể thêm mẫu mới.');
    }
  };

  const handleDeleteServerSign = async (id: string) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/signs/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      await fetchAdminSigns(adminToken);
      onToast('info', 'Đã xóa mẫu khỏi danh sách.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Tài khoản, Quản trị và SignLens Studio"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              Tài khoản &amp; SignLens Studio
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              Huấn luyện AI cá nhân &amp; quản trị ký hiệu
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng"
            className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Tabs */}
        <div className="px-4 sm:px-6 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'studio'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            SignLens Studio (Huấn luyện AI)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'admin'
                ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Quản trị viên (Admin)
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          {activeTab === 'studio' ? (
            <div className="space-y-5">
              {/* Camera Recorder */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 relative aspect-video overflow-hidden flex items-center justify-center">
                <video
                  ref={studioVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${studioCamOn ? 'block' : 'hidden'}`}
                />
                <canvas
                  ref={studioCanvasRef}
                  className={`absolute inset-0 w-full h-full pointer-events-none object-cover ${
                    studioCamOn ? 'block' : 'hidden'
                  }`}
                />
                {!studioCamOn && (
                  <button
                    type="button"
                    onClick={startStudioCamera}
                    className="h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    <span>Bật Camera để ghi mẫu ký hiệu</span>
                  </button>
                )}
                {countdownNum !== null && (
                  <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
                    <span className="font-display text-6xl font-extrabold text-white">
                      {countdownNum}
                    </span>
                  </div>
                )}
              </div>

              {isRecording && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <span>Đang ghi chuỗi 21 khớp tay...</span>
                    <span className="font-mono">{recordProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-rose-600 transition-all"
                      style={{ width: `${recordProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Label Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Chọn nhãn ký hiệu ({labels.length} nhãn · {samples.length} mẫu đã lưu)
                  </span>
                  <select
                    value={studioLang}
                    onChange={(e) => setStudioLang(e.target.value)}
                    className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                  >
                    <option value="VSL">VSL</option>
                    <option value="ASL">ASL</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {labels.map((lbl) => {
                    const count = samples.filter((s) => s.label === lbl).length;
                    return (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setSelectedLabel(lbl)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                          selectedLabel === lbl
                            ? 'border-sky-600 bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {lbl} ({count})
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLabelInput}
                    onChange={(e) => setNewLabelInput(e.target.value)}
                    placeholder="Tạo nhãn mới (VD: CAM_ON)..."
                    className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddLabel}
                    className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm nhãn</span>
                  </button>
                </div>
              </div>

              {/* Studio Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={isRecording || countdownNum !== null}
                  onClick={handleRecordGesture}
                  className="h-10 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  Ghi mẫu 3 giây cho {selectedLabel}
                </button>
                <button
                  type="button"
                  onClick={handleTrainModel}
                  className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Huấn luyện Model k-NN ({samples.length} mẫu)
                </button>
              </div>

              {/* Dataset Export / Import / Clear */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (samples.length === 0) {
                        onToast('warning', 'Chưa có mẫu dữ liệu để xuất.');
                        return;
                      }
                      const blob = new Blob(
                        [JSON.stringify({ name: 'SignLens Dataset', samples, labels }, null, 2)],
                        { type: 'application/json' }
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `signlens_dataset_${Date.now()}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Xuất JSON</span>
                  </button>
                  <label className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Nhập JSON</span>
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          try {
                            const parsed = JSON.parse(String(ev.target?.result || '{}')) as {
                              samples?: StudioSampleRecord[];
                            };
                            if (!Array.isArray(parsed.samples)) throw new Error('Invalid');
                            for (const s of parsed.samples) {
                              if (s.id && s.label && s.sequence) await saveStudioSample(s);
                            }
                            await refreshSamples();
                            onToast('success', `Đã nhập ${parsed.samples.length} mẫu.`);
                          } catch {
                            onToast('error', 'Tệp JSON dataset không hợp lệ.');
                          }
                        };
                        reader.readAsText(file);
                      }}
                    />
                  </label>
                </div>

                {!confirmClearSamples ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearSamples(true)}
                    className="text-rose-600 hover:underline cursor-pointer"
                  >
                    Xóa toàn bộ mẫu
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await clearAllStudioSamples();
                      await refreshSamples();
                      setConfirmClearSamples(false);
                      onToast('info', 'Đã xóa toàn bộ mẫu Studio.');
                    }}
                    className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold cursor-pointer"
                  >
                    Xác nhận xóa
                  </button>
                )}
              </div>
            </div>
          ) : !adminUser ? (
            /* ADMIN AUTH PANEL */
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {authStatus === 'unclaimed'
                      ? 'Thiết lập mật khẩu Quản trị lần đầu'
                      : 'Đăng nhập Quản trị viên'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {authStatus === 'unclaimed'
                      ? 'Tạo mật khẩu quản trị máy chủ SignLens (tối thiểu 6 ký tự).'
                      : 'Đăng nhập để thêm hoặc kiểm duyệt kho dữ liệu ký hiệu trên máy chủ.'}
                  </p>
                </div>
              </div>

              <form
                onSubmit={authStatus === 'unclaimed' ? handleSetupAdmin : handleLoginAdmin}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mật khẩu
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>

                {authStatus === 'unclaimed' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Xác nhận mật khẩu
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmSetupPassword}
                      onChange={(e) => setConfirmSetupPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu..."
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full h-10 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold cursor-pointer"
                >
                  {authSubmitting
                    ? 'Đang xử lý...'
                    : authStatus === 'unclaimed'
                      ? 'Lưu mật khẩu & Đăng nhập'
                      : 'Đăng nhập'}
                </button>
              </form>
            </div>
          ) : (
            /* ADMIN AUTHENTICATED MANAGEMENT */
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đã đăng nhập: {adminUser.fullName} ({adminUser.username})</span>
                </div>
                <button
                  type="button"
                  onClick={() => onAuthChange(null, null)}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>

              {/* Add Server Sign */}
              <form
                onSubmit={handleAddServerSign}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
              >
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-sky-600" />
                  <span>Thêm ký hiệu vào danh mục máy chủ</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={newSignLabel}
                    onChange={(e) => setNewSignLabel(e.target.value)}
                    placeholder="Nhãn (VD: XIN_LOI)"
                    className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={newSignMeaning}
                    onChange={(e) => setNewSignMeaning(e.target.value)}
                    placeholder="Nghĩa tiếng Việt (VD: Xin lỗi)"
                    className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSignYoutube}
                    onChange={(e) => setNewSignYoutube(e.target.value)}
                    placeholder="Link YouTube minh họa (tùy chọn)"
                    className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  />
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-lg bg-sky-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Thêm mới
                  </button>
                </div>
              </form>

              {/* Server Signs Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Danh mục máy chủ ({serverSigns.length} mục)
                </h4>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  {serverSigns.map((s) => (
                    <div
                      key={s.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {s.meaning_vi}{' '}
                          <span className="font-mono text-xs text-slate-500">({s.label})</span>
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {s.language} · {s.moderation_status}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteServerSign(s.id)}
                        aria-label={`Xóa ${s.meaning_vi}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
