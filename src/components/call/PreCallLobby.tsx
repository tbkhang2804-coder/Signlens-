import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  RefreshCw,
  ShieldAlert,
  SwitchCamera,
} from 'lucide-react';
import { buildRoomInviteUrl } from '../../utils/webrtcClient';
import { CamOffSvg, CamOnSvg, MicOffSvg, MicOnSvg } from '../Icons';

type DevicePermissionState = 'checking' | 'granted' | 'denied' | 'unavailable';

interface PreCallLobbyProps {
  roomCode: string;
  isHost: boolean;
  selectedRole: 'deaf' | 'hearing';
  onRoleChange: (role: 'deaf' | 'hearing') => void;
  onBack: () => void;
  onJoinCall: (params: {
    stream: MediaStream | null;
    camOn: boolean;
    micOn: boolean;
    selectedCamId: string;
    displayName: string;
  }) => void;
  onToast: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
}

export default function PreCallLobby({
  roomCode,
  isHost,
  selectedRole,
  onRoleChange,
  onBack,
  onJoinCall,
  onToast,
}: PreCallLobbyProps) {
  const [displayName, setDisplayName] = useState(
    selectedRole === 'deaf' ? 'Người dùng ngôn ngữ kí hiệu' : 'Người dùng ngôn ngữ nói'
  );
  const [camPerm, setCamPerm] = useState<DevicePermissionState>('checking');
  const [micPerm, setMicPerm] = useState<DevicePermissionState>('checking');
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamId, setSelectedCamId] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const handedOffToCallRef = useRef(false);

  const isSecureHttps = typeof window !== 'undefined' ? window.isSecureContext : true;

  const stopMeter = useCallback(() => {
    if (meterRafRef.current) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setMicLevel(0);
  }, []);

  const startMicMeter = useCallback(
    (stream: MediaStream) => {
      stopMeter();
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = ctx;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setMicLevel(Math.min(100, Math.round((avg / 70) * 100)));
          meterRafRef.current = requestAnimationFrame(tick);
        };
        meterRafRef.current = requestAnimationFrame(tick);
      } catch {
        // AudioContext blocked or unsupported
      }
    },
    [stopMeter]
  );

  const attachPreviewStream = useCallback(
    (stream: MediaStream | null) => {
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
        if (stream) {
          previewVideoRef.current.play().catch(() => {});
        }
      }
    },
    []
  );

  const requestDevices = useCallback(
    async (camDeviceId?: string) => {
      setPermissionMessage(null);
      setCamPerm('checking');
      setMicPerm('checking');

      if (!navigator.mediaDevices?.getUserMedia) {
        setCamPerm('unavailable');
        setMicPerm('unavailable');
        setCamOn(false);
        setMicOn(false);
        setPermissionMessage(
          'Trình duyệt hoặc môi trường hiện tại không hỗ trợ truy cập Camera/Micro (cần mở qua HTTPS trên Chrome, Safari hoặc Edge).'
        );
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      stopMeter();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: camDeviceId
            ? { deviceId: { exact: camDeviceId }, width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } }
            : {
                facingMode: 'user',
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                aspectRatio: { ideal: 1.7777777778 },
                frameRate: { ideal: 30, max: 30 },
              },
          audio: true,
        });
        streamRef.current = stream;
        attachPreviewStream(stream);
        startMicMeter(stream);

        const hasVideo = stream.getVideoTracks().length > 0;
        const hasAudio = stream.getAudioTracks().length > 0;
        setCamPerm(hasVideo ? 'granted' : 'unavailable');
        setMicPerm(hasAudio ? 'granted' : 'unavailable');
        setCamOn(hasVideo);
        setMicOn(hasAudio);

        const list = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = list.filter((d) => d.kind === 'videoinput');
        setCameras(videoInputs);
        const activeVidTrack = stream.getVideoTracks()[0];
        const activeId = activeVidTrack?.getSettings()?.deviceId || videoInputs[0]?.deviceId || '';
        if (activeId) setSelectedCamId(activeId);
      } catch (err) {
        const errName = err instanceof Error ? err.name : '';

        // Try fallback individually (e.g. camera-only or audio-only)
        let fallbackStream: MediaStream | null = null;
        let gotVideo = false;
        let gotAudio = false;

        try {
          const camOnly = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              aspectRatio: { ideal: 1.7777777778 },
            },
            audio: false,
          });
          fallbackStream = camOnly;
          gotVideo = true;
        } catch {
          // no camera
        }

        try {
          const micOnly = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          if (fallbackStream) {
            micOnly.getAudioTracks().forEach((t) => fallbackStream!.addTrack(t));
          } else {
            fallbackStream = micOnly;
          }
          gotAudio = true;
        } catch {
          // no mic
        }

        if (fallbackStream) {
          streamRef.current = fallbackStream;
          attachPreviewStream(fallbackStream);
          if (gotAudio) startMicMeter(fallbackStream);
        }

        setCamPerm(gotVideo ? 'granted' : errName === 'NotFoundError' ? 'unavailable' : 'denied');
        setMicPerm(gotAudio ? 'granted' : errName === 'NotFoundError' ? 'unavailable' : 'denied');
        setCamOn(gotVideo);
        setMicOn(gotAudio);

        if (!gotVideo && !gotAudio) {
          setPermissionMessage(
            errName === 'NotFoundError' || errName === 'DevicesNotFoundError'
              ? 'Không tìm thấy camera hoặc micro trên thiết bị. Bạn vẫn có thể tham gia để nhận phụ đề và nhắn tin.'
              : 'Bạn chưa cấp quyền Camera hoặc Micro cho SignLens. Hãy làm theo hướng dẫn bên dưới để bật quyền, hoặc tiếp tục tham gia ở chế độ phụ đề/văn bản.'
          );
        } else if (!gotVideo) {
          setPermissionMessage('Đã bật Micro nhưng chưa truy cập được Camera. Kiểm tra quyền Camera hoặc thiết bị khác đang chiếm dụng camera.');
        } else if (!gotAudio) {
          setPermissionMessage('Đã bật Camera nhưng chưa truy cập được Micro. Bạn vẫn có thể dùng ngôn ngữ ký hiệu và chat chữ.');
        }
      }
    },
    [attachPreviewStream, startMicMeter, stopMeter]
  );

  useEffect(() => {
    void requestDevices();
    return () => {
      stopMeter();
      if (!handedOffToCallRef.current && streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCamera = () => {
    if (!streamRef.current || camPerm !== 'granted') {
      void requestDevices(selectedCamId || undefined);
      return;
    }
    const next = !camOn;
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamOn(next);
  };

  const toggleMic = () => {
    if (!streamRef.current || micPerm !== 'granted') {
      void requestDevices(selectedCamId || undefined);
      return;
    }
    const next = !micOn;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicOn(next);
  };

  const cycleCamera = () => {
    if (cameras.length < 2) return;
    const currIdx = cameras.findIndex((c) => c.deviceId === selectedCamId);
    const nextCam = cameras[(currIdx + 1) % cameras.length];
    if (nextCam) {
      setSelectedCamId(nextCam.deviceId);
      void requestDevices(nextCam.deviceId);
    }
  };

  const handleJoin = () => {
    stopMeter();
    handedOffToCallRef.current = true;
    onJoinCall({
      stream: streamRef.current,
      camOn: camPerm === 'granted' ? camOn : false,
      micOn: micPerm === 'granted' ? micOn : false,
      selectedCamId,
      displayName: displayName.trim() || (selectedRole === 'deaf' ? 'Người dùng ngôn ngữ kí hiệu' : 'Người dùng ngôn ngữ nói'),
    });
  };

  const copyInvite = async () => {
    const url = buildRoomInviteUrl(roomCode);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      onToast('success', `Đã sao chép liên kết mời phòng ${roomCode}`);
    } catch {
      onToast('warning', 'Không thể tự sao chép liên kết. Hãy sao chép mã phòng thủ công.');
    }
  };

  return (
    <section className="max-w-5xl mx-auto px-3.5 sm:px-6 py-5 sm:py-9 space-y-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            stopMeter();
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((t) => t.stop());
              streamRef.current = null;
            }
            onBack();
          }}
          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="text-xs text-slate-600 dark:text-slate-300">
            Phòng:{' '}
            <span className="font-mono-code font-black text-slate-900 dark:text-white">
              {roomCode}
            </span>
          </div>
          {isHost && (
            <button
              type="button"
              onClick={copyInvite}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Đã sao chép liên kết' : 'Sao chép liên kết mời'}</span>
            </button>
          )}
        </div>
      </div>

      {!isSecureHttps && (
        <div
          role="alert"
          className="rounded-2xl bg-amber-500/15 border border-amber-500/40 p-4 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Kết nối hiện tại không dùng HTTPS. Trình duyệt di động chỉ cho phép bật Camera và Micro khi truy cập qua <strong>HTTPS</strong>.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left 7 Cols: Camera Preview + Media Toggles */}
        <div className="lg:col-span-7 glass-card rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                Kiểm tra camera &amp; micro
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đảm bảo khung hình thấy rõ tay và khuôn mặt trước khi tham gia cuộc gọi
              </p>
            </div>
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={cycleCamera}
                aria-label="Đổi camera trước hoặc sau"
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <SwitchCamera className="w-4 h-4" />
                <span className="hidden sm:inline">Đổi camera</span>
              </button>
            )}
          </div>

          <div className="relative w-full h-[270px] sm:h-[360px] rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
            <video
              ref={previewVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover mirror-view ${
                camPerm === 'granted' && camOn ? 'block' : 'hidden'
              }`}
            />

            {!(camPerm === 'granted' && camOn) && (
              <div className="text-center p-6 space-y-2.5 max-w-sm">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300">
                  <CamOffSvg className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-white">
                  {camPerm === 'checking'
                    ? 'Đang yêu cầu quyền truy cập camera...'
                    : camPerm === 'denied'
                      ? 'Chưa có quyền truy cập camera'
                      : camPerm === 'unavailable'
                        ? 'Không phát hiện camera'
                        : 'Camera đang tạm tắt'}
                </p>
                <p className="text-xs text-slate-400">
                  {camPerm === 'granted'
                    ? 'Nhấn nút Bật camera bên dưới để xem lại khung hình.'
                    : 'Bạn có thể thử cấp quyền lại hoặc vẫn tham gia cuộc gọi để dùng phụ đề.'}
                </p>
              </div>
            )}

            {/* Overlay Controls on Bottom of Preview */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-950/80 backdrop-blur-md border border-slate-700/80 px-3.5 py-2 rounded-2xl">
              <button
                type="button"
                onClick={toggleMic}
                aria-label={micOn ? 'Tắt micro' : 'Bật micro'}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  micPerm === 'granted' && micOn
                    ? 'bg-slate-800 hover:bg-slate-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {micPerm === 'granted' && micOn ? (
                  <MicOnSvg className="w-4 h-4" />
                ) : (
                  <MicOffSvg className="w-4 h-4" />
                )}
                <span>{micPerm === 'granted' && micOn ? 'Micro bật' : 'Micro tắt'}</span>
              </button>

              <button
                type="button"
                onClick={toggleCamera}
                aria-label={camOn ? 'Tắt camera' : 'Bật camera'}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  camPerm === 'granted' && camOn
                    ? 'bg-slate-800 hover:bg-slate-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {camPerm === 'granted' && camOn ? (
                  <CamOnSvg className="w-4 h-4" />
                ) : (
                  <CamOffSvg className="w-4 h-4" />
                )}
                <span>{camPerm === 'granted' && camOn ? 'Camera bật' : 'Camera tắt'}</span>
              </button>
            </div>
          </div>

          {/* Mic Audio Meter */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-center gap-3">
            <MicOnSvg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              Tín hiệu micro:
            </span>
            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-100 rounded-full"
                style={{ width: `${micPerm === 'granted' && micOn ? micLevel : 0}%` }}
              />
            </div>
            <span className="text-[11px] font-mono-code text-slate-500 dark:text-slate-400 w-9 text-right">
              {micPerm === 'granted' && micOn ? `${micLevel}%` : 'Tắt'}
            </span>
          </div>
        </div>

        {/* Right 5 Cols: Device Status + Permission Guide + Join CTA */}
        <div className="lg:col-span-5 glass-card rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Trạng thái thiết bị &amp; thông tin vào phòng
            </h2>

            {/* Device Status Rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <CamOnSvg className="w-4 h-4 text-sky-500" />
                  <span>Camera</span>
                </span>
                <span
                  className={`font-bold flex items-center gap-1.5 ${
                    camPerm === 'granted'
                      ? camOn
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {camPerm === 'granted' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {camPerm === 'checking'
                    ? 'Đang kiểm tra...'
                    : camPerm === 'granted'
                      ? camOn
                        ? 'Sẵn sàng (Đã bật)'
                        : 'Đã cấp quyền (Đang tắt)'
                      : camPerm === 'unavailable'
                        ? 'Không có thiết bị'
                        : 'Chưa cấp quyền'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <MicOnSvg className="w-4 h-4 text-emerald-500" />
                  <span>Microphone</span>
                </span>
                <span
                  className={`font-bold flex items-center gap-1.5 ${
                    micPerm === 'granted'
                      ? micOn
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {micPerm === 'granted' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {micPerm === 'checking'
                    ? 'Đang kiểm tra...'
                    : micPerm === 'granted'
                      ? micOn
                        ? 'Sẵn sàng (Đã bật)'
                        : 'Đã cấp quyền (Đang tắt)'
                      : micPerm === 'unavailable'
                        ? 'Không có thiết bị'
                        : 'Chưa cấp quyền'}
                </span>
              </div>
            </div>

            {/* Permission Trouble Guide */}
            {permissionMessage && (
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 space-y-2.5 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-start gap-2 font-bold">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>{permissionMessage}</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  <li>Nhấn biểu tượng ổ khóa hoặc cài đặt trang web cạnh thanh địa chỉ.</li>
                  <li>Chuyển quyền <strong>Camera</strong> và <strong>Microphone</strong> sang <strong>Cho phép (Allow)</strong>.</li>
                  <li>Nhấn nút <strong>Thử cấp quyền lại</strong> ngay bên dưới.</li>
                </ol>
                <button
                  type="button"
                  onClick={() => void requestDevices(selectedCamId || undefined)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Thử cấp quyền lại</span>
                </button>
              </div>
            )}

            {/* Display Name & Role */}
            <div className="space-y-2 pt-1">
              <label
                htmlFor="lobby-display-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Tên hiển thị của bạn
              </label>
              <input
                id="lobby-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={32}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Chế độ giao tiếp chính
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onRoleChange('deaf');
                    if (displayName === 'Người dùng ngôn ngữ nói' || displayName === 'Người nghe') {
                      setDisplayName('Người dùng ngôn ngữ kí hiệu');
                    }
                  }}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                    selectedRole === 'deaf'
                      ? 'bg-sky-500/15 border-sky-500 text-sky-700 dark:text-sky-300'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Người dùng ngôn ngữ kí hiệu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRoleChange('hearing');
                    if (displayName === 'Người dùng ngôn ngữ kí hiệu' || displayName === 'Người ký hiệu') {
                      setDisplayName('Người dùng ngôn ngữ nói');
                    }
                  }}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                    selectedRole === 'hearing'
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Người dùng ngôn ngữ nói
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <button
              type="button"
              onClick={handleJoin}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-extrabold shadow-xl shadow-emerald-500/20 inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <CamOnSvg className="w-4 h-4" />
              <span>Tham gia cuộc gọi</span>
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Copy className="w-3 h-3" />
              <span>Mã phòng {roomCode} · Kết nối WebRTC mã hóa trực tiếp</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
