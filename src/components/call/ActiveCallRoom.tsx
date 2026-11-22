import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Check,
  Copy,
  Hand,
  Link2,
  Maximize2,
  MessageSquare,
  QrCode,
  RefreshCw,
  Share2,
  SwitchCamera,
  X,
} from 'lucide-react';
import type { LandmarkPoint, RtcConnectionPhase } from '../../types/signlens';
import { getAllStudioSamples } from '../../utils/indexedDb';
import {
  DemoWaveDetector,
  StudioModelTrainer,
  drawHandSkeleton,
  speakVietnameseText,
} from '../../utils/gestureEngine';
import {
  buildRoomInviteUrl,
  endCallRoomApi,
  HostPeerRoomBridge,
  isPrivateDevPreviewOrigin,
  type CallTransportMode,
  type PeerMeta,
  PeerJSGuestSession,
  type RtcCaptionPayload,
  SignLensRtcSession,
} from '../../utils/webrtcClient';
import {
  CamOffSvg,
  CamOnSvg,
  EndCallSvg,
  MicOffSvg,
  MicOnSvg,
  SendSvg,
  SpeakerSvg,
} from '../Icons';

interface ActiveCallRoomProps {
  roomCode: string;
  isHost: boolean;
  transportMode?: CallTransportMode;
  hostBridge?: HostPeerRoomBridge | null;
  role: 'deaf' | 'hearing';
  displayName: string;
  initialStream: MediaStream | null;
  initialCamOn: boolean;
  initialMicOn: boolean;
  initialCamId: string;
  studioTrainedCount?: number;
  onExitCall: () => void;
  onToast: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
}

interface HandLandmarkerLike {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => { landmarks?: LandmarkPoint[][] };
}

interface SpeechRecLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
  }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface PhraseToken {
  code: string;
  word: string;
}

interface CallChatMessage extends RtcCaptionPayload {
  isSelf: boolean;
}

const VSL_QUICK_TOKENS: PhraseToken[] = [
  { code: 'XIN_CHAO', word: 'Xin chào' },
  { code: 'TOI_LA', word: 'Tôi là' },
  { code: 'CAM_ON', word: 'Cảm ơn' },
  { code: 'XIN_LOI', word: 'Xin lỗi' },
  { code: 'BAN_KHOE_KHONG', word: 'Bạn khỏe không?' },
  { code: 'NOI_CHAM_LAI', word: 'Vui lòng nói chậm lại' },
  { code: 'TOI_HIEU_ROI', word: 'Tôi hiểu rồi' },
  { code: 'CAN_HO_TRO', word: 'Tôi cần hỗ trợ' },
];

function formatVslBuffer(tokens: PhraseToken[]): string {
  if (tokens.length === 0) return '';
  const joined = tokens.map((t) => t.word).join(' ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

export default function ActiveCallRoom({
  roomCode,
  isHost,
  transportMode = 'ws',
  hostBridge = null,
  role,
  displayName,
  initialStream,
  initialCamOn,
  initialMicOn,
  initialCamId,
  studioTrainedCount = 0,
  onExitCall,
  onToast,
}: ActiveCallRoomProps) {
  const [clientId] = useState(
    () => `usr_${Math.random().toString(36).slice(2, 10)}`
  );
  const [rtcPhase, setRtcPhase] = useState<RtcConnectionPhase>('connecting_signal');
  const [phaseDetail, setPhaseDetail] = useState('Đang kết nối máy chủ tín hiệu...');
  const [turnConfigured, setTurnConfigured] = useState(false);
  const [remotePeer, setRemotePeer] = useState<PeerMeta | null>(null);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);

  // Local media state
  const [camOn, setCamOn] = useState(initialCamOn);
  const [micOn, setMicOn] = useState(initialMicOn);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamId, setSelectedCamId] = useState(initialCamId);
  const [videoFit, setVideoFit] = useState<'contain' | 'cover'>('contain');

  // VSL AI & Subtitles & Chat
  const [vslEnabled, setVslEnabled] = useState(role === 'deaf');
  const [vslReadyState, setVslReadyState] = useState<'off' | 'loading' | 'active' | 'error'>('off');
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [autoTts, setAutoTts] = useState(role === 'hearing');
  const [phraseBuffer, setPhraseBuffer] = useState<PhraseToken[]>([]);
  const [subtitles, setSubtitles] = useState<{ prev: string; curr: string; source: string }>({
    prev: '',
    curr: 'Phụ đề trực tiếp sẽ hiển thị tại đây khi hai bên giao tiếp bằng ký hiệu VSL, giọng nói hoặc văn bản.',
    source: 'Hệ thống SignLens',
  });
  const [chatMessages, setChatMessages] = useState<CallChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<'chat' | 'vsl'>(role === 'deaf' ? 'vsl' : 'chat');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isSpeechListening, setIsSpeechListening] = useState(false);
  const [lastRecognizedBadge, setLastRecognizedBadge] = useState<{ text: string; time: number } | null>(null);

  // Invite Modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const landmarkCanvasRef = useRef<HTMLCanvasElement>(null);
  const localStreamRef = useRef<MediaStream | null>(initialStream);
  const sessionRef = useRef<SignLensRtcSession | null>(null);
  const guestPeerSessionRef = useRef<PeerJSGuestSession | null>(null);
  const activeTransportRef = useRef<CallTransportMode | null>(null);
  const landmarkerRef = useRef<HandLandmarkerLike | null>(null);
  const vslRafRef = useRef<number | null>(null);
  const waveDetectorRef = useRef(new DemoWaveDetector());
  const speechRecRef = useRef<SpeechRecLike | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const autoCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSkeletonRef = useRef(showSkeleton);
  showSkeletonRef.current = showSkeleton;
  const autoTtsRef = useRef(autoTts);
  autoTtsRef.current = autoTts;
  const vslEnabledRef = useRef(vslEnabled);
  vslEnabledRef.current = vslEnabled;

  const canWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // Attach initial local stream
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((list) => setCameras(list.filter((d) => d.kind === 'videoinput')))
        .catch(() => {});
    }
  }, []);

  // Generate QR for invite modal
  useEffect(() => {
    if (!inviteModalOpen || qrDataUrl) return;
    QRCode.toDataURL(buildRoomInviteUrl(roomCode), {
      width: 220,
      margin: 2,
      color: { dark: '#0B0F19', light: '#FFFFFF' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {});
  }, [inviteModalOpen, qrDataUrl, roomCode]);

  // Call duration timer runs ONLY when actually connected
  useEffect(() => {
    if (rtcPhase !== 'connected') {
      if (rtcPhase === 'waiting_peer' || rtcPhase === 'disconnected') {
        setCallSeconds(0);
      }
      return;
    }
    const timer = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [rtcPhase]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, mobilePanelOpen, panelTab]);

  const appendSubtitleAndChat = useCallback(
    (payload: RtcCaptionPayload, isIncoming: boolean) => {
      const sourceLabel =
        payload.sourceType === 'deaf_sign'
          ? `${payload.senderName || 'Người dùng ngôn ngữ kí hiệu'} · Ký hiệu VSL`
          : payload.sourceType === 'hearing_voice'
            ? `${payload.senderName || 'Người dùng ngôn ngữ nói'} · Giọng nói`
            : `${payload.senderName || 'Thành viên'} · Văn bản`;

      setSubtitles((prev) => ({
        prev: prev.curr,
        curr: payload.text,
        source: sourceLabel,
      }));

      setChatMessages((prev) => [...prev.slice(-60), { ...payload, isSelf: !isIncoming }]);

      if (isIncoming) {
        if (payload.sourceType === 'deaf_sign' && autoTtsRef.current) {
          speakVietnameseText(payload.text);
        }
        setUnreadChatCount((c) => c + 1);
      }
    },
    []
  );

  // Connect WebRTC Signaling session (Host listens on both WS + PeerJS bridge; Guest picks best path with fallback)
  useEffect(() => {
    let cancelled = false;
    activeTransportRef.current = null;

    const applyRemoteStream = (stream: MediaStream | null) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        if (stream) {
          remoteVideoRef.current.play().catch(() => {});
        }
      }
      const hasVid = Boolean(stream && stream.getVideoTracks().length > 0);
      setRemoteHasVideo(hasVid);
    };

    const handleRoomEndedCallback = (reason: string) => {
      if (cancelled) return;
      onToast('info', reason);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      onExitCall();
    };

    const startGuestPeerJs = () => {
      if (cancelled) return;
      if (sessionRef.current) {
        sessionRef.current.disconnect(false);
        sessionRef.current = null;
      }
      activeTransportRef.current = 'peerjs';
      const peerSession = new PeerJSGuestSession({
        roomCode,
        displayName,
        role,
        initialStream: localStreamRef.current,
        callbacks: {
          onPhaseChange: (phase, detail) => {
            if (cancelled) return;
            setRtcPhase(phase);
            if (detail) setPhaseDetail(detail);
          },
          onRemoteStream: (stream) => {
            if (!cancelled) applyRemoteStream(stream);
          },
          onPeerChange: (peer) => {
            if (!cancelled) setRemotePeer(peer);
          },
          onCaptionReceived: (caption) => {
            if (!cancelled) appendSubtitleAndChat(caption, true);
          },
          onRoomEnded: handleRoomEndedCallback,
          onError: (msg) => {
            if (!cancelled) onToast('error', msg);
          },
          onTurnConfigKnown: (configured) => {
            if (!cancelled) setTurnConfigured(configured);
          },
        },
      });
      guestPeerSessionRef.current = peerSession;
      void peerSession.connect(initialCamOn, initialMicOn);
    };

    if (isHost) {
      const wsSession = new SignLensRtcSession({
        roomCode,
        clientId,
        displayName,
        role,
        isHost: true,
        initialStream: localStreamRef.current,
        callbacks: {
          onPhaseChange: (phase, detail) => {
            if (cancelled) return;
            if (activeTransportRef.current === 'peerjs' && !wsSession.hasActivePeer()) {
              return;
            }
            if (wsSession.hasActivePeer() && (phase === 'negotiating' || phase === 'connected')) {
              activeTransportRef.current = 'ws';
            }
            setRtcPhase(phase);
            if (detail) setPhaseDetail(detail);
          },
          onRemoteStream: (stream) => {
            if (cancelled) return;
            if (!stream && activeTransportRef.current === 'peerjs') return;
            if (stream) activeTransportRef.current = 'ws';
            applyRemoteStream(stream);
          },
          onPeerChange: (peer) => {
            if (cancelled) return;
            if (!peer && activeTransportRef.current === 'peerjs') return;
            if (peer) activeTransportRef.current = 'ws';
            else if (activeTransportRef.current === 'ws') activeTransportRef.current = null;
            setRemotePeer(peer);
          },
          onCaptionReceived: (caption) => {
            if (!cancelled) appendSubtitleAndChat(caption, true);
          },
          onRoomEnded: handleRoomEndedCallback,
          onError: (msg) => {
            if (!cancelled && activeTransportRef.current !== 'peerjs') {
              onToast('error', msg);
            }
          },
          onTurnConfigKnown: (configured) => {
            if (!cancelled) setTurnConfigured(configured);
          },
        },
      });
      sessionRef.current = wsSession;
      void wsSession.connect(initialCamOn, initialMicOn);

      if (hostBridge) {
        void hostBridge.start();
        hostBridge.attachActiveCall({
          localStream: localStreamRef.current,
          displayName,
          role,
          camOn: initialCamOn,
          micOn: initialMicOn,
          callbacks: {
            onPhaseChange: (phase, detail) => {
              if (cancelled) return;
              if (activeTransportRef.current === 'ws' && !hostBridge.hasActivePeer()) {
                return;
              }
              if (hostBridge.hasActivePeer() && (phase === 'negotiating' || phase === 'connected')) {
                activeTransportRef.current = 'peerjs';
              }
              setRtcPhase(phase);
              if (detail) setPhaseDetail(detail);
            },
            onRemoteStream: (stream) => {
              if (cancelled) return;
              if (!stream && activeTransportRef.current === 'ws') return;
              if (stream) activeTransportRef.current = 'peerjs';
              applyRemoteStream(stream);
            },
            onPeerChange: (peer) => {
              if (cancelled) return;
              if (!peer && activeTransportRef.current === 'ws') return;
              if (peer) activeTransportRef.current = 'peerjs';
              else if (activeTransportRef.current === 'peerjs') activeTransportRef.current = null;
              setRemotePeer(peer);
            },
            onCaptionReceived: (caption) => {
              if (!cancelled) appendSubtitleAndChat(caption, true);
            },
            onRoomEnded: handleRoomEndedCallback,
            onError: (msg) => {
              if (!cancelled && activeTransportRef.current !== 'ws') {
                onToast('error', msg);
              }
            },
            onTurnConfigKnown: (configured) => {
              if (!cancelled) setTurnConfigured(configured);
            },
          },
        });
      }
    } else if (transportMode === 'peerjs') {
      startGuestPeerJs();
    } else {
      activeTransportRef.current = 'ws';
      const session = new SignLensRtcSession({
        roomCode,
        clientId,
        displayName,
        role,
        isHost: false,
        initialStream: localStreamRef.current,
        callbacks: {
          onPhaseChange: (phase, detail) => {
            if (cancelled || activeTransportRef.current !== 'ws') return;
            setRtcPhase(phase);
            if (detail) setPhaseDetail(detail);
          },
          onRemoteStream: (stream) => {
            if (!cancelled && activeTransportRef.current === 'ws') applyRemoteStream(stream);
          },
          onPeerChange: (peer) => {
            if (!cancelled && activeTransportRef.current === 'ws') setRemotePeer(peer);
          },
          onCaptionReceived: (caption) => {
            if (!cancelled && activeTransportRef.current === 'ws') appendSubtitleAndChat(caption, true);
          },
          onRoomEnded: handleRoomEndedCallback,
          onError: (msg, code) => {
            if (cancelled) return;
            if (code === 'ROOM_NOT_FOUND') {
              // Automatically bridge to cross-origin/multi-instance PeerJS host
              startGuestPeerJs();
              return;
            }
            onToast('error', msg);
          },
          onTurnConfigKnown: (configured) => {
            if (!cancelled) setTurnConfigured(configured);
          },
        },
      });
      sessionRef.current = session;
      void session.connect(initialCamOn, initialMicOn);
    }

    return () => {
      cancelled = true;
      if (vslRafRef.current) cancelAnimationFrame(vslRafRef.current);
      if (autoCommitTimerRef.current) clearTimeout(autoCommitTimerRef.current);
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {
          // ignore
        }
      }
      sessionRef.current?.disconnect(false);
      sessionRef.current = null;
      guestPeerSessionRef.current?.disconnect();
      guestPeerSessionRef.current = null;
      hostBridge?.detachActiveCall();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, clientId]);

  const sendMessageOut = useCallback(
    (rawText: string, sourceType: RtcCaptionPayload['sourceType']) => {
      const clean = rawText.trim();
      if (!clean) return;
      const payload: RtcCaptionPayload = {
        id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: clean,
        sourceType,
        senderName: displayName,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      appendSubtitleAndChat(payload, false);
      if (guestPeerSessionRef.current) {
        guestPeerSessionRef.current.sendCaption(payload);
      } else if (isHost && hostBridge?.hasActivePeer()) {
        hostBridge.sendCaption(payload);
      } else {
        sessionRef.current?.sendCaption(payload);
      }
    },
    [appendSubtitleAndChat, displayName, hostBridge, isHost]
  );

  const pushVslToken = useCallback(
    (code: string, word: string) => {
      setPhraseBuffer((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].code === code) return prev;
        const next = [...prev, { code, word }];
        if (autoCommitTimerRef.current) clearTimeout(autoCommitTimerRef.current);
        autoCommitTimerRef.current = setTimeout(() => {
          const sentence = formatVslBuffer(next);
          if (sentence) sendMessageOut(sentence, 'deaf_sign');
          setPhraseBuffer([]);
        }, 2400);
        return next;
      });
    },
    [sendMessageOut]
  );

  // VSL MediaPipe HandLandmarker recognition loop (runs only when vslEnabled && camOn)
  useEffect(() => {
    if (!vslEnabled || !camOn || !localStreamRef.current) {
      if (vslRafRef.current) {
        cancelAnimationFrame(vslRafRef.current);
        vslRafRef.current = null;
      }
      const canvas = landmarkCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      setVslReadyState('off');
      return;
    }

    let cancelled = false;

    const startVslLoop = async () => {
      if (!landmarkerRef.current) {
        setVslReadyState('loading');
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
          if (!cancelled) setVslReadyState('error');
          return;
        }
      }

      if (cancelled) return;
      setVslReadyState('active');

      // Tự động đồng bộ các mẫu đã ghi / xuất trong Phòng Lab và nạp mô hình VSL
      try {
        const storedSamples = await getAllStudioSamples();
        if (storedSamples && storedSamples.length > 0) {
          StudioModelTrainer.trainFromSamples(storedSamples);
        } else {
          StudioModelTrainer.loadFromStorage();
        }
      } catch {
        StudioModelTrainer.loadFromStorage();
      }

      let lastVideoTime = -1;
      const tick = (now: number) => {
        if (cancelled || !vslEnabledRef.current) return;
        const videoEl = localVideoRef.current;
        const canvasEl = landmarkCanvasRef.current;

        if (videoEl && canvasEl && videoEl.readyState >= 2) {
          const targetW = videoEl.videoWidth || 640;
          const targetH = videoEl.videoHeight || 480;
          if (canvasEl.width !== targetW || canvasEl.height !== targetH) {
            canvasEl.width = targetW;
            canvasEl.height = targetH;
          }
          const ctx = canvasEl.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

          if (landmarkerRef.current && videoEl.currentTime !== lastVideoTime) {
            lastVideoTime = videoEl.currentTime;
            try {
              const res = landmarkerRef.current.detectForVideo(videoEl, now);
              const hands = res?.landmarks || [];
              if (hands.length > 0) {
                if (showSkeletonRef.current && ctx) {
                  hands.forEach((h) => drawHandSkeleton(ctx, h));
                }

                // 1. Nhận diện k-NN cải tiến với bộ lọc ổn định đa frame
                const studioPred = StudioModelTrainer.predict(hands, now, 'VSL');
                if (studioPred) {
                  // Chuyển trực tiếp sang đoạn chat và cập nhật phụ đề ngay lập tức
                  sendMessageOut(studioPred.sign, 'deaf_sign');
                  setLastRecognizedBadge({ text: studioPred.sign, time: now });
                } else {
                  // 2. Nhận diện quy tắc cử chỉ vẫy tay
                  const wave = waveDetectorRef.current.update(hands[0][0].x, now);
                  if (wave) {
                    sendMessageOut('Xin chào', 'deaf_sign');
                    setLastRecognizedBadge({ text: 'Xin chào', time: now });
                  }
                }
              } else {
                // Khi không còn bàn tay trong khung hình, reset bộ đệm vote
                StudioModelTrainer.resetHistory();
              }
            } catch {
              // ignore transient frame error
            }
          }
        }
        vslRafRef.current = requestAnimationFrame(tick);
      };

      vslRafRef.current = requestAnimationFrame(tick);
    };

    void startVslLoop();

    return () => {
      cancelled = true;
      if (vslRafRef.current) {
        cancelAnimationFrame(vslRafRef.current);
        vslRafRef.current = null;
      }
    };
  }, [vslEnabled, camOn, pushVslToken]);

  const syncMediaStateAll = (nextCam: boolean, nextMic: boolean) => {
    sessionRef.current?.sendMediaState(nextCam, nextMic);
    guestPeerSessionRef.current?.sendMediaState(nextCam, nextMic);
    hostBridge?.sendMediaState(nextCam, nextMic);
  };

  const replaceTrackAll = async (newTrack: MediaStreamTrack | null, updatedStream: MediaStream | null) => {
    await sessionRef.current?.replaceVideoTrack(newTrack, updatedStream);
    await guestPeerSessionRef.current?.replaceVideoTrack(newTrack, updatedStream);
    await hostBridge?.replaceVideoTrack(newTrack, updatedStream);
  };

  const handleToggleCamera = async () => {
    const stream = localStreamRef.current;
    const videoTrack = stream?.getVideoTracks()[0];

    if (videoTrack) {
      const next = !camOn;
      videoTrack.enabled = next;
      setCamOn(next);
      syncMediaStateAll(next, micOn);
      return;
    }

    // Request camera with fixed 16:9 720p constraints to prevent mobile browser auto-zoom/ultra-wide distortion
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: selectedCamId
          ? { deviceId: { exact: selectedCamId }, width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } }
          : {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              aspectRatio: { ideal: 1.7777777778 },
              frameRate: { ideal: 30, max: 30 },
            },
        audio: false,
      });
      const newTrack = camStream.getVideoTracks()[0];
      if (newTrack) {
        const targetStream = localStreamRef.current || new MediaStream();
        targetStream.addTrack(newTrack);
        localStreamRef.current = targetStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = targetStream;
          await localVideoRef.current.play().catch(() => {});
        }
        await replaceTrackAll(newTrack, targetStream);
        setCamOn(true);
        syncMediaStateAll(true, micOn);
      }
    } catch {
      onToast('warning', 'Không thể bật camera. Hãy kiểm tra quyền truy cập camera của trình duyệt.');
    }
  };

  const handleToggleMic = async () => {
    const stream = localStreamRef.current;
    const audioTrack = stream?.getAudioTracks()[0];

    if (audioTrack) {
      const next = !micOn;
      audioTrack.enabled = next;
      setMicOn(next);
      syncMediaStateAll(camOn, next);
      return;
    }

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const newTrack = micStream.getAudioTracks()[0];
      if (newTrack) {
        const targetStream = localStreamRef.current || new MediaStream();
        targetStream.addTrack(newTrack);
        localStreamRef.current = targetStream;
        setMicOn(true);
        syncMediaStateAll(camOn, true);
      }
    } catch {
      onToast('warning', 'Không thể bật micro. Hãy kiểm tra quyền truy cập micro của trình duyệt.');
    }
  };

  const handleFlipCamera = async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    let nextId = '';
    if (cameras.length > 1) {
      const idx = cameras.findIndex((c) => c.deviceId === selectedCamId);
      nextId = cameras[(idx + 1) % cameras.length].deviceId;
    }

    try {
      const newCamStream = await navigator.mediaDevices.getUserMedia({
        video: nextId
          ? { deviceId: { exact: nextId }, width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } }
          : {
              facingMode: { ideal: nextFacing },
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              aspectRatio: { ideal: 1.7777777778 },
              frameRate: { ideal: 30, max: 30 },
            },
        audio: false,
      });
      const newTrack = newCamStream.getVideoTracks()[0];
      if (!newTrack) return;

      const stream = localStreamRef.current || new MediaStream();
      stream.getVideoTracks().forEach((old) => {
        stream.removeTrack(old);
        old.stop();
      });
      stream.addTrack(newTrack);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(() => {});
      }
      await replaceTrackAll(newTrack, stream);
      setFacingMode(nextFacing);
      if (nextId) setSelectedCamId(nextId);
      setCamOn(true);
    } catch {
      onToast('warning', 'Thiết bị không hỗ trợ đổi sang camera khác.');
    }
  };

  const toggleSpeechToSubtitle = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecLike;
      webkitSpeechRecognition?: new () => SpeechRecLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      onToast('warning', 'Trình duyệt không hỗ trợ nhận diện giọng nói. Bạn có thể gõ tin nhắn bên dưới.');
      return;
    }

    if (isSpeechListening && speechRecRef.current) {
      speechRecRef.current.stop();
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'vi-VN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => setIsSpeechListening(true);
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript;
          if (transcript.trim()) {
            sendMessageOut(transcript, 'hearing_voice');
          }
        }
      }
    };
    rec.onerror = () => setIsSpeechListening(false);
    rec.onend = () => setIsSpeechListening(false);
    speechRecRef.current = rec;

    try {
      rec.start();
    } catch {
      setIsSpeechListening(false);
    }
  };

  const handleEndCall = async () => {
    if (vslRafRef.current) cancelAnimationFrame(vslRafRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    sessionRef.current?.disconnect(isHost);
    guestPeerSessionRef.current?.disconnect();
    hostBridge?.destroy(isHost);
    if (isHost) {
      await endCallRoomApi(roomCode);
    }
    onExitCall();
  };

  const handleCopyInvite = async (type: 'code' | 'link') => {
    const val = type === 'code' ? roomCode : buildRoomInviteUrl(roomCode);
    try {
      await navigator.clipboard.writeText(val);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
      onToast('success', type === 'code' ? `Đã sao chép mã ${roomCode}` : 'Đã sao chép liên kết mời');
    } catch {
      onToast('warning', 'Không thể tự sao chép.');
    }
  };

  const handleShareInvite = async () => {
    if (!canWebShare) return;
    try {
      await navigator.share({
        title: `Tham gia cuộc gọi SignLens (${roomCode})`,
        url: buildRoomInviteUrl(roomCode),
      });
    } catch {
      // cancelled
    }
  };

  const formattedTimer = `${String(Math.floor(callSeconds / 60)).padStart(2, '0')}:${String(
    callSeconds % 60
  ).padStart(2, '0')}`;

  const statusMeta: Record<RtcConnectionPhase, { label: string; dotClass: string; badgeClass: string }> = {
    idle: {
      label: 'Chưa kết nối',
      dotClass: 'bg-slate-400',
      badgeClass: 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    },
    connecting_signal: {
      label: 'Đang kết nối tín hiệu...',
      dotClass: 'bg-amber-400',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    },
    waiting_peer: {
      label: 'Đang chờ người tham gia',
      dotClass: 'bg-sky-400',
      badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    },
    negotiating: {
      label: 'Đang thiết lập P2P...',
      dotClass: 'bg-amber-400',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    },
    connected: {
      label: `Đã kết nối · ${formattedTimer}`,
      dotClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    },
    reconnecting: {
      label: 'Đang khôi phục kết nối...',
      dotClass: 'bg-amber-500',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    },
    disconnected: {
      label: 'Đã ngắt kết nối',
      dotClass: 'bg-slate-400',
      badgeClass: 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    },
    failed: {
      label: 'Mất / Lỗi kết nối P2P',
      dotClass: 'bg-rose-500',
      badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    },
  };

  const activeStatus = statusMeta[rtcPhase];

  return (
    <section className="max-w-[1440px] mx-auto px-2.5 sm:px-6 py-3 sm:py-5 space-y-3 sm:space-y-4">
      {/* Top Room Status Strip */}
      <div className="glass-card rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="font-mono-code text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-wider">
            {roomCode}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] sm:text-xs font-bold whitespace-nowrap ${activeStatus.badgeClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${activeStatus.dotClass}`} />
            <span>{activeStatus.label}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInviteModalOpen(true)}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <QrCode className="w-3.5 h-3.5 text-sky-500" />
            <span>Mời / QR</span>
          </button>

          {rtcPhase === 'failed' && (
            <button
              type="button"
              onClick={() => {
                if (guestPeerSessionRef.current) {
                  void guestPeerSessionRef.current.retryConnection();
                } else if (isHost && hostBridge?.hasActivePeer()) {
                  void hostBridge.retryConnection();
                } else {
                  void sessionRef.current?.retryConnection();
                }
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Video Call Center + Supporting Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Video Call Center (8 Cols on Desktop, Full Width on Mobile) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {/* Primary Video Stage */}
          <div className="relative w-full h-[54dvh] min-h-[340px] sm:h-[520px] rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center">
            {/* Quick Video Fit Toggle Button (prevents auto-zoom / cropping hands in VSL) */}
            <button
              type="button"
              onClick={() => setVideoFit((f) => (f === 'contain' ? 'cover' : 'contain'))}
              title={
                videoFit === 'contain'
                  ? 'Đang để Vừa khung (Không bị zoom/cắt tay). Bấm để chuyển Tràn viền.'
                  : 'Đang để Tràn viền (Zoom đầy). Bấm để chuyển Vừa khung.'
              }
              className="absolute top-3 left-3 z-30 px-2.5 py-1.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 text-white border border-slate-700/80 text-[11px] font-bold backdrop-blur-md flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
            >
              <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
              <span>{videoFit === 'contain' ? 'Vừa khung (Không cắt tay)' : 'Tràn viền'}</span>
            </button>

            {/* Remote Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full ${videoFit === 'cover' ? 'object-cover' : 'object-contain'} ${
                rtcPhase === 'connected' && remoteHasVideo ? 'block' : 'hidden'
              }`}
            />

            {/* Waiting / Negotiating / Failed State Overlay (Never fakes "Connected") */}
            {(rtcPhase !== 'connected' || !remoteHasVideo) && (
              <div className="relative z-10 text-center px-5 py-6 max-w-md space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400">
                  {rtcPhase === 'failed' ? (
                    <AlertTriangle className="w-6 h-6 text-rose-400" />
                  ) : (
                    <CamOnSvg className="w-6 h-6" />
                  )}
                </div>

                {rtcPhase === 'connected' && !remoteHasVideo ? (
                  <>
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      {remotePeer?.displayName || 'Người tham gia'} đang tắt camera
                    </h2>
                    <p className="text-xs text-slate-400">
                      Kết nối đã thiết lập. Bạn vẫn có thể trao đổi qua âm thanh, phụ đề và khung chat.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-base sm:text-lg font-bold text-white">{phaseDetail}</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {rtcPhase === 'failed' && !turnConfigured
                        ? 'Hai thiết bị có thể đang ở khác mạng NAT nghiêm ngặt và máy chủ chưa cấu hình TURN relay. Hãy thử cùng Wi-Fi hoặc cấu hình TURN_URL.'
                        : `Chia sẻ mã phòng ${roomCode} hoặc liên kết mời để người thứ hai tham gia cuộc gọi.`}
                    </p>
                    {(rtcPhase === 'failed' || rtcPhase === 'reconnecting') && (
                      <div className="pt-2 flex justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            void sessionRef.current?.retryConnection();
                            onToast('info', 'Đang thử khôi phục lại kết nối WebRTC...');
                          }}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-lg"
                        >
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Thử kết nối lại</span>
                        </button>
                      </div>
                    )}
                    {rtcPhase === 'waiting_peer' && (
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopyInvite('link')}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Sao chép liên kết mời</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInviteModalOpen(true)}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Hiện mã QR</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Local PiP Camera + VSL Landmark Skeleton */}
            <div className="absolute top-3 right-3 w-28 aspect-[3/4] sm:w-48 sm:aspect-video rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl overflow-hidden z-20 flex items-center justify-center">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full ${videoFit === 'cover' ? 'object-cover' : 'object-contain'} ${
                  facingMode === 'user' ? 'mirror-view' : ''
                } ${camOn ? 'block' : 'hidden'}`}
              />
              <canvas
                ref={landmarkCanvasRef}
                className={`absolute inset-0 w-full h-full ${videoFit === 'cover' ? 'object-cover' : 'object-contain'} pointer-events-none ${
                  facingMode === 'user' ? 'mirror-view' : ''
                } ${camOn && vslEnabled ? 'block' : 'hidden'}`}
              />
              {!camOn && (
                <div className="text-center p-2 space-y-1">
                  <CamOffSvg className="w-5 h-5 mx-auto text-slate-400" />
                  <span className="block text-[10px] text-slate-400 font-medium">Cam tắt</span>
                </div>
              )}
              {vslEnabled && camOn && (
                <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-950/80 text-[9px] font-bold text-emerald-300">
                  {vslReadyState === 'active'
                    ? 'VSL AI Bật'
                    : vslReadyState === 'loading'
                      ? 'Đang nạp VSL...'
                      : 'VSL'}
                </span>
              )}
              {lastRecognizedBadge && Date.now() - lastRecognizedBadge.time < 2200 && (
                <div className="absolute top-1.5 left-1.5 right-1.5 z-30 px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[10px] sm:text-xs font-black shadow-lg flex items-center justify-center gap-1 animate-pulse">
                  <span>✨</span>
                  <span className="truncate">&quot;{lastRecognizedBadge.text}&quot;</span>
                </div>
              )}
            </div>
          </div>

          {/* Dedicated Live Subtitle Dock (Tách riêng bên dưới camera, đảm bảo không che mặt & cử chỉ tay) */}
          <div className="rounded-2xl border border-sky-500/30 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md p-3 sm:p-3.5 shadow-xl transition-all">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-[11px] sm:text-xs font-bold text-sky-400 dark:text-sky-300 truncate">
                  Phụ đề trực tiếp · {subtitles.source}
                </span>
              </div>
              <button
                type="button"
                onClick={() => speakVietnameseText(subtitles.curr)}
                aria-label="Đọc to phụ đề tiếng Việt"
                className="min-h-[28px] px-2.5 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
              >
                <SpeakerSvg className="w-3.5 h-3.5" />
                <span>Đọc to</span>
              </button>
            </div>
            {subtitles.prev && (
              <p className="text-[11px] text-slate-400 truncate mb-0.5">{subtitles.prev}</p>
            )}
            <p className="text-xs sm:text-base font-extrabold text-white leading-snug break-words">
              {subtitles.curr}
            </p>
          </div>

          {/* Primary Call Controls Dock (Ergonomic Thumb Zone on Mobile) */}
          <div className="glass-card rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-center sm:justify-between gap-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void handleToggleMic()}
                aria-label={micOn ? 'Tắt micro' : 'Bật micro'}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  micOn
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'bg-rose-600 text-white'
                }`}
              >
                {micOn ? <MicOnSvg className="w-4 h-4" /> : <MicOffSvg className="w-4 h-4" />}
                <span>{micOn ? 'Micro' : 'Đang tắt mic'}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleToggleCamera()}
                aria-label={camOn ? 'Tắt camera' : 'Bật camera'}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  camOn
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    : 'bg-rose-600 text-white'
                }`}
              >
                {camOn ? <CamOnSvg className="w-4 h-4" /> : <CamOffSvg className="w-4 h-4" />}
                <span>{camOn ? 'Camera' : 'Đang tắt cam'}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleFlipCamera()}
                aria-label="Đổi camera trước sau"
                className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <SwitchCamera className="w-4 h-4" />
                <span className="hidden sm:inline">Đổi cam</span>
              </button>

              <button
                type="button"
                onClick={() => setVideoFit((f) => (f === 'contain' ? 'cover' : 'contain'))}
                aria-label="Đổi chế độ căn chỉnh camera"
                className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title={videoFit === 'contain' ? 'Đang để vừa khung hình (không cắt tay). Bấm để chuyển tràn viền.' : 'Đang để tràn viền (zoom đầy). Bấm để chuyển vừa khung.'}
              >
                <Maximize2 className="w-4 h-4 text-sky-400" />
                <span className="hidden sm:inline">{videoFit === 'contain' ? 'Vừa khung' : 'Tràn viền'}</span>
              </button>

              <button
                type="button"
                onClick={() => setVslEnabled((v) => !v)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  vslEnabled
                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-700 dark:text-sky-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Hand className="w-4 h-4" />
                <span>{vslEnabled ? 'VSL AI: Bật' : 'VSL AI: Tắt'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobilePanelOpen((o) => !o);
                  setUnreadChatCount(0);
                }}
                className="lg:hidden relative min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat &amp; VSL</span>
                {unreadChatCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleEndCall()}
              aria-label="Kết thúc cuộc gọi"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-lg shadow-rose-600/25 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <EndCallSvg className="w-4 h-4" />
              <span>Kết thúc cuộc gọi</span>
            </button>
          </div>
        </div>

        {/* Right Supporting Panel: VSL Recognition + Chat + Voice-to-Subtitle */}
        <div
          className={`lg:col-span-4 glass-card rounded-3xl p-4 flex-col justify-between gap-3 ${
            mobilePanelOpen ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Panel Tab Switcher */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex-1">
              <button
                type="button"
                onClick={() => {
                  setPanelTab('chat');
                  setUnreadChatCount(0);
                }}
                className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  panelTab === 'chat'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Chat &amp; Giọng nói
              </button>
              <button
                type="button"
                onClick={() => setPanelTab('vsl')}
                className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  panelTab === 'vsl'
                    ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Nhận diện VSL
              </button>
            </div>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={autoTts}
                onChange={(e) => setAutoTts(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              <span>Tự đọc VSL</span>
            </label>
          </div>

          {panelTab === 'chat' ? (
            <>
              {/* Two-way Text Chat Feed */}
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto min-h-[220px] max-h-[310px] space-y-2.5 pr-1"
              >
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8 px-4 text-xs text-slate-500 dark:text-slate-400">
                    Chưa có tin nhắn. Nội dung nhận diện VSL, giọng nói tiếng Việt hoặc tin nhắn văn bản sẽ đồng bộ trực tiếp tại đây.
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isSelf = msg.isSelf;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isSelf ? 'items-end ml-auto' : 'items-start mr-auto'} max-w-[82%] mb-1`}
                      >
                        <div
                          className={`text-[10px] mb-1 flex items-center gap-1.5 ${
                            isSelf
                              ? 'justify-end text-emerald-600 dark:text-emerald-400 font-bold'
                              : 'justify-start text-sky-600 dark:text-sky-400 font-bold'
                          }`}
                        >
                          <span>{isSelf ? 'Bạn' : msg.senderName || 'Đối phương'}</span>
                          <span className="text-slate-400" aria-hidden="true">·</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-[9px] font-semibold text-slate-700 dark:text-slate-300">
                            {msg.sourceType === 'deaf_sign'
                              ? 'VSL'
                              : msg.sourceType === 'hearing_voice'
                                ? 'Giọng nói'
                                : 'Văn bản'}
                          </span>
                          <span className="text-slate-400" aria-hidden="true">·</span>
                          <span className="text-slate-400 font-normal">{msg.timestamp}</span>
                        </div>
                        <div
                          className={`w-full rounded-2xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed border flex items-center gap-2 shadow-sm ${
                            isSelf
                              ? 'rounded-tr-xs bg-emerald-600 text-white border-emerald-500/40'
                              : 'rounded-tl-xs bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700/80'
                          }`}
                        >
                          <span className="flex-1 break-words">{msg.text}</span>
                          <button
                            type="button"
                            onClick={() => speakVietnameseText(msg.text)}
                            aria-label="Đọc tin nhắn"
                            className={`shrink-0 cursor-pointer p-1 rounded-lg transition-colors ${
                              isSelf
                                ? 'text-white/80 hover:text-white hover:bg-white/15'
                                : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            <SpeakerSvg className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Text + Voice Input */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chatInput.trim()) return;
                    sendMessageOut(chatInput, 'text');
                    setChatInput('');
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Nhập tin nhắn trao đổi..."
                    className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    aria-label="Gửi tin nhắn"
                    className="min-h-[42px] px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 inline-flex items-center justify-center cursor-pointer"
                  >
                    <SendSvg className="w-4 h-4" />
                  </button>
                </form>

                <button
                  type="button"
                  onClick={toggleSpeechToSubtitle}
                  className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    isSpeechListening
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {isSpeechListening ? <MicOffSvg className="w-4 h-4" /> : <MicOnSvg className="w-4 h-4" />}
                  <span>
                    {isSpeechListening
                      ? 'Dừng chuyển giọng nói thành phụ đề'
                      : 'Nói tiếng Việt để tạo phụ đề trực tiếp'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            /* VSL Sign Recognition & Sentence Composer Tab */
            <div className="space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Nhận diện VSL qua Camera
                    </span>
                    <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                      {vslReadyState === 'active'
                        ? studioTrainedCount > 0
                          ? `AI Studio (${studioTrainedCount} mẫu) + Vẫy tay`
                          : 'Đang theo dõi 21 khớp tay'
                        : vslReadyState === 'loading'
                          ? 'Đang khởi tạo MediaPipe...'
                          : 'Đang tạm tắt'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setVslEnabled((v) => !v)}
                      className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                        vslEnabled
                          ? 'bg-sky-500 text-slate-950 border-sky-400'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {vslEnabled ? 'Tạm dừng nhận diện' : 'Bật nhận diện VSL'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSkeleton((s) => !s)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      {showSkeleton ? 'Ẩn khung tay' : 'Hiện khung tay'}
                    </button>
                  </div>
                </div>

                {/* Phrase Builder Buffer */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Chuỗi ký hiệu chuyển văn bản
                    </span>
                    {phraseBuffer.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPhraseBuffer([])}
                        className="text-[11px] font-semibold text-rose-500 cursor-pointer"
                      >
                        Xóa chuỗi
                      </button>
                    )}
                  </div>
                  <div className="min-h-[42px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {phraseBuffer.length > 0
                      ? formatVslBuffer(phraseBuffer)
                      : 'Thực hiện ký hiệu trước camera hoặc chạm các cụm từ nhanh bên dưới...'}
                  </div>
                  <button
                    type="button"
                    disabled={phraseBuffer.length === 0}
                    onClick={() => {
                      const sentence = formatVslBuffer(phraseBuffer);
                      if (sentence) sendMessageOut(sentence, 'deaf_sign');
                      setPhraseBuffer([]);
                    }}
                    className="w-full min-h-[38px] rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-extrabold cursor-pointer"
                  >
                    Phát thành phụ đề &amp; gửi sang máy kia
                  </button>
                </div>
              </div>

              {/* Quick VSL Phrase Chips */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Cụm từ VSL nhanh:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VSL_QUICK_TOKENS.map((tok) => (
                    <button
                      key={tok.code}
                      type="button"
                      onClick={() => sendMessageOut(tok.word, 'deaf_sign')}
                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-sky-500/20 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {tok.word}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite / QR Modal */}
      {inviteModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInviteModalOpen(false)}
        >
          <div
            className="glass-card rounded-3xl max-w-sm w-full p-5 space-y-4 border-sky-500/30 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Mời thiết bị thứ hai
              </h3>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                aria-label="Đóng cửa sổ mời"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center space-y-3">
              <div className="w-48 h-48 mx-auto rounded-2xl bg-white p-2.5 border border-slate-200 shadow-sm flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR mời phòng ${roomCode}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <QrCode className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <div className="font-mono-code text-2xl font-black text-slate-900 dark:text-white">
                {roomCode}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyInvite('code')}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedType === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Sao chép mã</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyInvite('link')}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedType === 'link' ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                  <span>Sao chép link</span>
                </button>
              </div>
              {canWebShare && (
                <button
                  type="button"
                  onClick={handleShareInvite}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Chia sẻ liên kết</span>
                </button>
              )}
              {isPrivateDevPreviewOrigin() && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5 text-left leading-relaxed">
                  Link Dev Preview (<code className="font-mono-code">ais-dev</code>) yêu cầu đăng nhập cùng tài khoản Google chủ dự án trên máy thứ hai. Để test tự do, hãy dùng chế độ Share App (<code className="font-mono-code">ais-pre</code>) trên cả hai thiết bị.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
