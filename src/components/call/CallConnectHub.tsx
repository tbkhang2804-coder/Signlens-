import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  AlertCircle,
  Check,
  Copy,
  Link2,
  Loader2,
  LogIn,
  QrCode,
  RefreshCw,
  Share2,
  X,
} from 'lucide-react';
import type { CallRoomSummary } from '../../types/signlens';
import {
  buildRoomInviteUrl,
  checkCallRoom,
  checkServerRoom,
  createCallRoom,
  extractRoomCodeFromInput,
  getSharedPreviewBaseUrl,
  isPrivateDevPreviewOrigin,
  type CallTransportMode,
} from '../../utils/webrtcClient';
import { CamOnSvg } from '../Icons';

interface CallConnectHubProps {
  initialRoomCode?: string;
  initialError?: string | null;
  selectedRole: 'deaf' | 'hearing';
  onRoleChange: (role: 'deaf' | 'hearing') => void;
  onHostRoomCreated?: (roomCode: string) => void;
  onProceedToLobby: (roomCode: string, isHost: boolean, transport?: CallTransportMode) => void;
  onToast: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
}

export default function CallConnectHub({
  initialRoomCode = '',
  initialError = null,
  selectedRole,
  onRoleChange,
  onHostRoomCreated,
  onProceedToLobby,
  onToast,
}: CallConnectHubProps) {
  const [createdRoom, setCreatedRoom] = useState<CallRoomSummary | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [roomLiveStatus, setRoomLiveStatus] = useState<'waiting' | 'active' | 'ended'>('waiting');
  const [roomParticipantCount, setRoomParticipantCount] = useState(0);
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);

  const [joinInput, setJoinInput] = useState(initialRoomCode);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(initialError);

  // In-app QR Scanner modal
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerVideoRef = useRef<HTMLVideoElement>(null);
  const scannerCanvasRef = useRef<HTMLCanvasElement>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerRafRef = useRef<number | null>(null);

  const canWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (initialRoomCode) setJoinInput(initialRoomCode);
  }, [initialRoomCode]);

  useEffect(() => {
    if (initialError) setJoinError(initialError);
  }, [initialError]);

  // Generate QR code containing full invite URL
  useEffect(() => {
    if (!createdRoom) {
      setQrDataUrl('');
      return;
    }
    const inviteUrl = buildRoomInviteUrl(createdRoom.code);
    QRCode.toDataURL(inviteUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#0B0F19', light: '#FFFFFF' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [createdRoom]);

  // Poll same-origin server room status while host hasn't entered lobby yet (avoids self-probing PeerJS)
  useEffect(() => {
    if (!createdRoom) return;
    let active = true;
    const poll = async () => {
      const res = await checkServerRoom(createdRoom.code);
      if (!active) return;
      if (res.exists && (res.status === 'waiting' || res.status === 'active' || res.status === 'ended')) {
        setRoomLiveStatus(res.status);
        setRoomParticipantCount(res.participantCount || 0);
      }
    };
    const timer = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [createdRoom]);

  const stopQrScanner = () => {
    if (scannerRafRef.current) {
      cancelAnimationFrame(scannerRafRef.current);
      scannerRafRef.current = null;
    }
    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach((t) => t.stop());
      scannerStreamRef.current = null;
    }
    setScannerOpen(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRafRef.current) cancelAnimationFrame(scannerRafRef.current);
      if (scannerStreamRef.current) {
        scannerStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleCreateRoom = async () => {
    setCreatingRoom(true);
    const res = await createCallRoom();
    setCreatingRoom(false);
    if (!res.ok || !res.room) {
      onToast('error', res.error || 'Không thể tạo phòng gọi video.');
      return;
    }
    setCreatedRoom(res.room);
    setRoomLiveStatus('waiting');
    setRoomParticipantCount(0);
    onHostRoomCreated?.(res.room.code);
    onToast('success', `Đã tạo phòng ${res.room.code}. Hãy gửi mã hoặc QR cho người tham gia!`);
  };

  const handleCopy = async (type: 'code' | 'link') => {
    if (!createdRoom) return;
    const text = type === 'code' ? createdRoom.code : buildRoomInviteUrl(createdRoom.code);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
      onToast(
        'success',
        type === 'code' ? `Đã sao chép mã phòng ${createdRoom.code}` : 'Đã sao chép liên kết mời tham gia!'
      );
    } catch {
      onToast('warning', 'Trình duyệt chưa cấp quyền clipboard. Hãy chọn và sao chép thủ công.');
    }
  };

  const handleShareInvite = async () => {
    if (!createdRoom || !canWebShare) return;
    const inviteUrl = buildRoomInviteUrl(createdRoom.code);
    try {
      await navigator.share({
        title: `Tham gia cuộc gọi SignLens (${createdRoom.code})`,
        text: `Mời bạn tham gia cuộc gọi video SignLens hỗ trợ ngôn ngữ ký hiệu VSL và phụ đề. Mã phòng: ${createdRoom.code}`,
        url: inviteUrl,
      });
    } catch {
      // User cancelled share sheet
    }
  };

  const handleJoinRoom = async (rawOverride?: string) => {
    const candidate = rawOverride ?? joinInput;
    const normalized = extractRoomCodeFromInput(candidate);
    if (!normalized) {
      setJoinError('Mã phòng chưa hợp lệ. Hãy nhập mã phòng dạng SL-1234 hoặc dán liên kết mời.');
      return;
    }

    setJoiningRoom(true);
    setJoinError(null);
    const check = await checkCallRoom(normalized);
    setJoiningRoom(false);

    if (!check.exists || check.status === 'not_found') {
      setJoinError(check.error || `Phòng ${normalized} không tồn tại hoặc đã hết hạn.`);
      return;
    }
    if (check.status === 'ended') {
      setJoinError(`Phòng ${normalized} đã kết thúc cuộc gọi.`);
      return;
    }
    if (check.full) {
      setJoinError(`Phòng ${normalized} hiện đã đủ 2 người tham gia.`);
      return;
    }

    onProceedToLobby(normalized, false, check.transport || 'ws');
  };

  const startQrScanner = async () => {
    setScannerError(null);
    setScannerOpen(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError('Trình duyệt không hỗ trợ mở camera trực tiếp. Bạn có thể dùng camera mặc định của điện thoại để quét mã QR.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      scannerStreamRef.current = stream;

      const attachAndScan = () => {
        const video = scannerVideoRef.current;
        const canvas = scannerCanvasRef.current;
        if (!video || !canvas) {
          scannerRafRef.current = requestAnimationFrame(attachAndScan);
          return;
        }
        if (video.srcObject !== stream) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
        if (video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (decoded?.data) {
              const extracted = extractRoomCodeFromInput(decoded.data);
              if (extracted) {
                stopQrScanner();
                setJoinInput(extracted);
                onToast('success', `Đã quét được mã phòng ${extracted}`);
                void handleJoinRoom(extracted);
                return;
              }
            }
          }
        }
        scannerRafRef.current = requestAnimationFrame(attachAndScan);
      };

      scannerRafRef.current = requestAnimationFrame(attachAndScan);
    } catch {
      setScannerError(
        'Không thể truy cập camera để quét QR. Hãy cấp quyền Camera cho trình duyệt hoặc mở ứng dụng Camera trên điện thoại để quét mã QR mời.'
      );
    }
  };

  return (
    <section className="max-w-5xl mx-auto px-3.5 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Kết nối cuộc gọi
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            Tạo phòng gọi video hai thiết bị mới hoặc nhập mã phòng để tham gia cùng phụ đề và nhận diện VSL.
          </p>
        </div>

        {/* Role Preference Segmented Control */}
        <div
          className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 self-start sm:self-auto"
          role="group"
          aria-label="Vai trò tham gia"
        >
          <button
            type="button"
            onClick={() => onRoleChange('deaf')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              selectedRole === 'deaf'
                ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Người dùng ngôn ngữ kí hiệu
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('hearing')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              selectedRole === 'hearing'
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Người dùng ngôn ngữ nói
          </button>
        </div>
      </div>

      {/* Main Two-Column Choice */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-stretch">
        {/* A. Create Room Card */}
        <div className="glass-card rounded-3xl p-5 sm:p-7 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CamOnSvg className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  A. Tạo phòng gọi video
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nhận mã phòng, mã QR và liên kết để mời thiết bị thứ hai
                </p>
              </div>
            </div>

            {!createdRoom ? (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">01.</span>
                    <span>Tạo mã phòng riêng tư dễ đọc cho mỗi cuộc trò chuyện.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">02.</span>
                    <span>Quét QR bằng điện thoại hoặc gửi liên kết mời một chạm.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">03.</span>
                    <span>Kiểm tra trước camera và micro trước khi kết nối trực tiếp.</span>
                  </li>
                </ul>

                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={creatingRoom}
                  className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-sm font-extrabold shadow-lg shadow-emerald-500/20 inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {creatingRoom ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang khởi tạo phòng...</span>
                    </>
                  ) : (
                    <>
                      <CamOnSvg className="w-4 h-4" />
                      <span>Tạo phòng gọi video</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Readable Room ID + QR */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-36 h-36 sm:w-32 sm:h-32 rounded-2xl bg-white p-2 border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`Mã QR tham gia phòng ${createdRoom.code}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <QrCode className="w-10 h-10 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 w-full text-center sm:text-left space-y-2.5">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Mã phòng của bạn · Quét QR bằng camera điện thoại
                    </div>
                    <div className="font-mono-code text-2xl sm:text-3xl font-black tracking-wider text-slate-900 dark:text-white">
                      {createdRoom.code}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center justify-center sm:justify-start gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          roomLiveStatus === 'active'
                            ? 'bg-emerald-500'
                            : roomLiveStatus === 'ended'
                              ? 'bg-rose-500'
                              : 'bg-amber-400'
                        }`}
                      />
                      <span>
                        {roomLiveStatus === 'active'
                          ? `Đã có ${roomParticipantCount} người trong phòng`
                          : roomLiveStatus === 'ended'
                            ? 'Phòng đã kết thúc'
                            : 'Đang chờ người tham gia'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Copy & Share Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleCopy('code')}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedType === 'code' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>Sao chép mã phòng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy('link')}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedType === 'link' ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />}
                    <span>Sao chép liên kết mời</span>
                  </button>
                </div>

                {canWebShare && (
                  <button
                    type="button"
                    onClick={handleShareInvite}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Chia sẻ liên kết</span>
                  </button>
                )}

                {isPrivateDevPreviewOrigin() && (
                  <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>Hỗ trợ ghép phòng liên miền</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                      Nếu người kia đang mở web qua liên kết công khai (<code className="font-mono-code">ais-pre-...</code>), họ chỉ cần nhập mã <strong className="font-mono-code">{createdRoom.code}</strong> hoặc dùng nút bên dưới để sao chép đúng liên kết công khai cho máy kia.
                    </p>
                    {getSharedPreviewBaseUrl() && (
                      <button
                        type="button"
                        onClick={async () => {
                          const sharedBase = getSharedPreviewBaseUrl();
                          if (!sharedBase) return;
                          const url = buildRoomInviteUrl(createdRoom.code, sharedBase);
                          try {
                            await navigator.clipboard.writeText(url);
                            onToast('success', 'Đã sao chép liên kết công khai (ais-pre) cho điện thoại kia!');
                          } catch {
                            onToast('warning', 'Không thể tự sao chép liên kết.');
                          }
                        }}
                        className="w-full min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/35 text-amber-900 dark:text-amber-200 text-[11px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Sao chép liên kết công khai (ais-pre)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {createdRoom && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                onClick={() => onProceedToLobby(createdRoom.code, true, 'ws')}
                className="w-full sm:flex-1 min-h-[48px] px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-extrabold shadow-lg shadow-emerald-500/20 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <CamOnSvg className="w-4 h-4" />
                <span>Kiểm tra thiết bị &amp; Vào phòng</span>
              </button>
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={creatingRoom}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Đổi mã phòng</span>
              </button>
            </div>
          )}
        </div>

        {/* B. Join Room Card */}
        <div className="glass-card rounded-3xl p-5 sm:p-7 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/25 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  B. Tham gia phòng
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nhập mã phòng từ người gửi hoặc quét QR để kết nối ngay
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleJoinRoom();
              }}
              className="space-y-3"
            >
              <label
                htmlFor="join-room-code-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Mã phòng gọi video (hoặc dán liên kết mời)
              </label>
              <input
                id="join-room-code-input"
                type="text"
                value={joinInput}
                onChange={(e) => {
                  setJoinInput(e.target.value);
                  if (joinError) setJoinError(null);
                }}
                placeholder="Ví dụ: SL-4829"
                className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono-code text-base font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
              />

              {joinError && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{joinError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={joiningRoom || !joinInput.trim()}
                className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-slate-900 dark:bg-sky-500 hover:bg-slate-800 dark:hover:bg-sky-400 disabled:opacity-50 text-white dark:text-slate-950 text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {joiningRoom ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang kiểm tra phòng...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Tham gia phòng</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <button
              type="button"
              onClick={startQrScanner}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Quét mã QR bằng camera</span>
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Trên điện thoại, bạn cũng có thể mở ứng dụng Camera mặc định để quét mã QR và truy cập trực tiếp.
            </p>
          </div>
        </div>
      </div>

      {/* QR Camera Scanner Modal */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl max-w-md w-full p-5 space-y-4 border-sky-500/30 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-sky-500" />
                <span>Quét mã QR tham gia phòng</span>
              </h3>
              <button
                type="button"
                onClick={stopQrScanner}
                aria-label="Đóng trình quét QR"
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {scannerError ? (
              <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-700 dark:text-rose-300 space-y-3">
                <p className="leading-relaxed">{scannerError}</p>
                <button
                  type="button"
                  onClick={stopQrScanner}
                  className="w-full min-h-[42px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
                >
                  Đóng và nhập mã phòng thủ công
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative aspect-square w-full max-w-[300px] mx-auto rounded-2xl overflow-hidden bg-slate-950 border border-slate-700">
                  <video
                    ref={scannerVideoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-2xl pointer-events-none" />
                </div>
                <canvas ref={scannerCanvasRef} className="hidden" />
                <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                  Đưa camera hướng thẳng vào mã QR hiển thị trên thiết bị tạo phòng.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
