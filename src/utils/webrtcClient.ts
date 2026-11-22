import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
import type { CallRoomSummary, RtcConnectionPhase } from '../types/signlens';

export interface RtcConfigResponse {
  iceServers: RTCIceServer[];
  turnConfigured: boolean;
}

export type CallTransportMode = 'ws' | 'peerjs';

export interface RoomCheckResult {
  exists: boolean;
  code?: string;
  status: 'waiting' | 'active' | 'ended' | 'not_found' | 'invalid';
  participantCount?: number;
  full?: boolean;
  transport?: CallTransportMode;
  error?: string;
  createdAt?: string;
  expiresAt?: string;
}

export interface PeerMeta {
  peerId: string;
  displayName: string;
  role: 'deaf' | 'hearing';
  camOn: boolean;
  micOn: boolean;
}

export interface RtcCaptionPayload {
  id: string;
  text: string;
  sourceType: 'deaf_sign' | 'hearing_voice' | 'text';
  senderName?: string;
  timestamp: string;
}

export function extractRoomCodeFromInput(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  // Support pasting full invite URL (?room=SL-1234)
  if (trimmed.includes('://') || trimmed.includes('room=')) {
    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://signlens.local/${trimmed}`);
      const param = parsed.searchParams.get('room');
      if (param) {
        return extractRoomCodeFromInput(param);
      }
    } catch {
      // fall back to regex cleanup
    }
  }

  const cleaned = trimmed.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('SL-')) return cleaned.slice(0, 12);
  const body = cleaned.startsWith('SL') ? cleaned.slice(2) : cleaned;
  if (body.length < 3) return '';
  return `SL-${body.slice(0, 8)}`;
}

export function roomCodeToPeerId(roomCode: string): string {
  const clean = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `signlens-v2-${clean}`;
}

export function buildRoomInviteUrl(roomCode: string, baseOrigin?: string): string {
  if (typeof window === 'undefined') return `?room=${encodeURIComponent(roomCode)}`;
  const origin = baseOrigin || window.location.origin;
  return `${origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`;
}

export function isPrivateDevPreviewOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('ais-dev-');
}

export function getSharedPreviewBaseUrl(): string | null {
  if (typeof window === 'undefined' || !isPrivateDevPreviewOrigin()) return null;
  const sharedHost = window.location.hostname.replace(/^ais-dev-/, 'ais-pre-');
  return `${window.location.protocol}//${sharedHost}`;
}

export async function fetchRtcConfig(): Promise<RtcConfigResponse> {
  try {
    const res = await fetch('/api/rtc-config');
    if (res.ok) {
      const data = (await res.json()) as { iceServers?: RTCIceServer[]; turnConfigured?: boolean };
      if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        return {
          iceServers: data.iceServers,
          turnConfigured: Boolean(data.turnConfigured),
        };
      }
    }
  } catch {
    // Fallback to Google STUN below
  }
  return {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
          'stun:stun4.l.google.com:19302',
          'stun:stun.cloudflare.com:3478',
          'stun:global.stun.twilio.com:3478',
          'stun:stun.services.mozilla.com',
        ],
      },
    ],
    turnConfigured: false,
  };
}

export async function createCallRoom(): Promise<{ ok: boolean; room?: CallRoomSummary; error?: string }> {
  try {
    const res = await fetch('/api/rooms', { method: 'POST' });
    const data = (await res.json()) as { success?: boolean; room?: CallRoomSummary; error?: string };
    if (res.ok && data.room) {
      return { ok: true, room: data.room };
    }
  } catch {
    // Fall back to deterministic room creation so PeerJS room bridge still works even on static previews
  }

  const now = Date.now();
  const code = `SL-${Math.floor(1000 + Math.random() * 9000)}`;
  return {
    ok: true,
    room: {
      code,
      status: 'waiting',
      participantCount: 0,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
    },
  };
}

export async function checkServerRoom(code: string): Promise<RoomCheckResult> {
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { exists: false, status: 'not_found' };
    }
    const data = (await res.json()) as RoomCheckResult;
    if (res.status === 404) {
      return {
        exists: false,
        status: 'not_found',
        error: data.error || 'Phòng không tồn tại hoặc đã hết hạn.',
      };
    }
    return { ...data, transport: 'ws' };
  } catch {
    return {
      exists: false,
      status: 'not_found',
      error: 'Không thể kiểm tra phòng với máy chủ.',
    };
  }
}

export async function probePeerJsRoom(roomCode: string, timeoutMs = 4000): Promise<RoomCheckResult> {
  const targetPeerId = roomCodeToPeerId(roomCode);
  const rtcCfg = await fetchRtcConfig();

  return new Promise<RoomCheckResult>((resolve) => {
    let settled = false;
    let probePeer: Peer | null = null;
    let conn: DataConnection | null = null;

    const finish = (result: RoomCheckResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        conn?.close();
      } catch {
        // ignore
      }
      try {
        probePeer?.destroy();
      } catch {
        // ignore
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        exists: false,
        status: 'not_found',
        error: `Phòng ${roomCode} không tồn tại hoặc chủ phòng chưa sẵn sàng.`,
      });
    }, timeoutMs);

    try {
      probePeer = new Peer({
        debug: 0,
        config: { iceServers: rtcCfg.iceServers },
      });

      probePeer.on('open', () => {
        if (settled || !probePeer) return;
        conn = probePeer.connect(targetPeerId, { reliable: true });
        conn.on('open', () => {
          conn?.send({ type: 'probe' });
        });
        conn.on('data', (raw) => {
          const msg = raw as { type?: string; status?: 'waiting' | 'active' | 'ended'; full?: boolean };
          if (msg?.type === 'probe-ack') {
            finish({
              exists: true,
              code: roomCode,
              status: msg.status || 'waiting',
              full: Boolean(msg.full),
              transport: 'peerjs',
            });
          }
        });
        conn.on('error', () => {
          finish({ exists: false, status: 'not_found' });
        });
      });

      probePeer.on('error', () => {
        finish({ exists: false, status: 'not_found' });
      });
    } catch {
      finish({ exists: false, status: 'not_found' });
    }
  });
}

export async function checkCallRoom(rawCode: string): Promise<RoomCheckResult> {
  const code = extractRoomCodeFromInput(typeof rawCode === 'string' ? rawCode : '');
  if (!code) {
    return {
      exists: false,
      status: 'invalid',
      error: 'Mã phòng không hợp lệ. Vui lòng nhập mã gồm ít nhất 4 ký tự (VD: SL-4829).',
    };
  }

  // 1. Check same-origin server registry first
  const serverRes = await checkServerRoom(code);
  if (serverRes.exists) {
    return serverRes;
  }

  // 2. Fallback: Probe cross-origin / multi-instance PeerJS room bridge
  const peerRes = await probePeerJsRoom(code);
  if (peerRes.exists) {
    return peerRes;
  }

  return {
    exists: false,
    status: 'not_found',
    error: serverRes.error || `Phòng ${code} không tồn tại hoặc chủ phòng chưa mở phòng.`,
  };
}

export async function endCallRoomApi(code: string): Promise<void> {
  try {
    await fetch(`/api/rooms/${encodeURIComponent(code)}/end`, { method: 'POST' });
  } catch {
    // ignore network cleanup failures
  }
}

export interface RtcSessionCallbacks {
  onPhaseChange: (phase: RtcConnectionPhase, detail?: string) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onPeerChange: (peer: PeerMeta | null) => void;
  onCaptionReceived: (caption: RtcCaptionPayload) => void;
  onRoomEnded: (reason: string) => void;
  onError: (message: string, code?: string) => void;
  onTurnConfigKnown: (turnConfigured: boolean) => void;
}

/**
 * Persistent Host PeerJS Room Bridge kept alive from Room Creation through Active Call
 * so guests on different URLs (e.g. ais-dev vs ais-pre) or different Cloud Run instances can join seamlessly.
 */
export class HostPeerRoomBridge {
  readonly roomCode: string;
  private peer: Peer | null = null;
  private activeDataConn: DataConnection | null = null;
  private activeMediaCall: MediaConnection | null = null;
  private localStream: MediaStream | null = null;
  private callbacks: RtcSessionCallbacks | null = null;
  private pendingGuestMeta: PeerMeta | null = null;
  private hostInfo: { displayName: string; role: 'deaf' | 'hearing'; camOn: boolean; micOn: boolean } = {
    displayName: 'Chủ phòng',
    role: 'deaf',
    camOn: true,
    micOn: true,
  };
  private roomEnded = false;

  constructor(roomCode: string) {
    this.roomCode = roomCode;
  }

  async start(): Promise<void> {
    if (this.peer && !this.peer.destroyed) return;
    const rtcCfg = await fetchRtcConfig();
    const peerId = roomCodeToPeerId(this.roomCode);

    const peer = new Peer(peerId, {
      debug: 0,
      config: { iceServers: rtcCfg.iceServers },
    });
    this.peer = peer;

    peer.on('error', (err) => {
      // Avoid unhandled PeerJS errors; report only if active call callbacks are attached
      const errType = (err as { type?: string })?.type;
      if (errType === 'unavailable-id' || errType === 'network' || errType === 'server-error') {
        this.callbacks?.onPhaseChange('reconnecting', 'Đang kết nối lại cầu nối phòng...');
      }
    });

    peer.on('connection', (conn) => {
      conn.on('data', (raw) => {
        const msg = raw as Record<string, unknown>;
        if (msg?.type === 'probe') {
          conn.send({
            type: 'probe-ack',
            status: this.roomEnded ? 'ended' : this.activeMediaCall ? 'active' : 'waiting',
            full: Boolean(this.activeDataConn && this.activeDataConn.open && this.activeDataConn !== conn),
          });
          return;
        }

        if (msg?.type === 'guest-hello') {
          this.activeDataConn = conn;
          const guestMeta: PeerMeta = {
            peerId: conn.peer,
            displayName: String(msg.displayName || 'Người tham gia'),
            role: msg.role === 'deaf' ? 'deaf' : 'hearing',
            camOn: Boolean(msg.camOn),
            micOn: Boolean(msg.micOn),
          };
          this.pendingGuestMeta = guestMeta;

          const hostReady = Boolean(this.callbacks);
          conn.send({
            type: 'host-hello',
            ready: hostReady,
            ...this.hostInfo,
          });

          if (this.callbacks) {
            this.callbacks.onPeerChange(guestMeta);
            this.callbacks.onPhaseChange('negotiating', 'Đang kết nối với thiết bị tham gia...');
          }
          return;
        }

        if (msg?.type === 'request-host-stream' && this.localStream && this.peer && this.callbacks) {
          try {
            const call = this.peer.call(conn.peer, this.localStream);
            this.attachMediaCall(call);
          } catch {
            // ignore
          }
          return;
        }

        if (msg?.type === 'caption' && msg.payload) {
          this.callbacks?.onCaptionReceived(msg.payload as RtcCaptionPayload);
          return;
        }

        if (msg?.type === 'media-state') {
          const updatedMeta: PeerMeta = {
            peerId: conn.peer,
            displayName: String(msg.displayName || 'Người tham gia'),
            role: msg.role === 'deaf' ? 'deaf' : 'hearing',
            camOn: Boolean(msg.camOn),
            micOn: Boolean(msg.micOn),
          };
          this.pendingGuestMeta = updatedMeta;
          this.callbacks?.onPeerChange(updatedMeta);
        }
      });

      conn.on('close', () => {
        if (this.activeDataConn === conn) {
          this.activeDataConn = null;
          this.pendingGuestMeta = null;
          this.activeMediaCall?.close();
          this.activeMediaCall = null;
          this.callbacks?.onRemoteStream(null);
          this.callbacks?.onPeerChange(null);
          this.callbacks?.onPhaseChange('waiting_peer', 'Người tham gia đã rời phòng.');
        }
      });
    });

    peer.on('call', (incomingCall) => {
      if (!this.callbacks) {
        incomingCall.close();
        return;
      }
      this.callbacks.onPhaseChange('negotiating', 'Đang kết nối luồng video WebRTC...');
      incomingCall.answer(this.localStream || undefined);
      this.attachMediaCall(incomingCall);
    });
  }

  attachActiveCall(params: {
    localStream: MediaStream | null;
    displayName: string;
    role: 'deaf' | 'hearing';
    camOn: boolean;
    micOn: boolean;
    callbacks: RtcSessionCallbacks;
  }): void {
    this.localStream = params.localStream;
    this.callbacks = params.callbacks;
    this.hostInfo = {
      displayName: params.displayName,
      role: params.role,
      camOn: params.camOn,
      micOn: params.micOn,
    };

    // If Guest already joined via PeerJS while Host was in PreCallLobby, wake Guest up immediately
    if (this.activeDataConn?.open) {
      if (this.pendingGuestMeta) {
        this.callbacks.onPeerChange(this.pendingGuestMeta);
      }
      this.callbacks.onPhaseChange('negotiating', 'Người tham gia đang chờ, đang thiết lập video...');
      this.activeDataConn.send({
        type: 'host-hello',
        ready: true,
        ...this.hostInfo,
      });
    }
  }

  detachActiveCall(): void {
    this.callbacks = null;
    this.pendingGuestMeta = null;
    this.activeMediaCall?.close();
    this.activeMediaCall = null;
    this.activeDataConn?.close();
    this.activeDataConn = null;
  }

  private attachMediaCall(call: MediaConnection): void {
    this.activeMediaCall = call;
    call.on('stream', (remoteStream) => {
      this.callbacks?.onRemoteStream(remoteStream);
      this.callbacks?.onPhaseChange('connected', 'Đã kết nối P2P trực tiếp');
    });

    const pc = (call as unknown as { peerConnection?: RTCPeerConnection }).peerConnection;
    if (pc) {
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          this.callbacks?.onPhaseChange('connected', 'Đã kết nối P2P trực tiếp');
        } else if (pc.connectionState === 'disconnected') {
          this.callbacks?.onPhaseChange('reconnecting', 'Đang khôi phục kết nối...');
        } else if (pc.connectionState === 'failed') {
          this.callbacks?.onPhaseChange('failed', 'Kết nối WebRTC trực tiếp thất bại.');
        }
      };
    }

    call.on('close', () => {
      if (this.activeMediaCall === call) {
        this.activeMediaCall = null;
        this.callbacks?.onRemoteStream(null);
        this.callbacks?.onPhaseChange('waiting_peer', 'Đang chờ người tham gia...');
      }
    });
  }

  hasActivePeer(): boolean {
    return Boolean(this.activeDataConn?.open || this.activeMediaCall);
  }

  sendCaption(payload: RtcCaptionPayload): boolean {
    if (this.activeDataConn?.open) {
      this.activeDataConn.send({ type: 'caption', payload });
      return true;
    }
    return false;
  }

  sendMediaState(camOn: boolean, micOn: boolean): void {
    this.hostInfo.camOn = camOn;
    this.hostInfo.micOn = micOn;
    if (this.activeDataConn?.open) {
      this.activeDataConn.send({
        type: 'media-state',
        ...this.hostInfo,
      });
    }
  }

  async replaceVideoTrack(newTrack: MediaStreamTrack | null, updatedStream: MediaStream | null): Promise<void> {
    this.localStream = updatedStream;
    const pc = (this.activeMediaCall as unknown as { peerConnection?: RTCPeerConnection })?.peerConnection;
    if (!pc) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  }

  async retryConnection(): Promise<void> {
    if (!this.activeDataConn?.open) return;
    this.activeDataConn.send({
      type: 'host-hello',
      ready: true,
      ...this.hostInfo,
    });
  }

  destroy(endRoom = false): void {
    this.roomEnded = endRoom;
    if (endRoom && this.activeDataConn?.open) {
      try {
        this.activeDataConn.send({ type: 'room-ended', reason: 'Chủ phòng đã kết thúc cuộc gọi.' });
      } catch {
        // ignore
      }
    }
    this.detachActiveCall();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }
  }
}

/**
 * Guest PeerJS Session used automatically when room exists across another domain/instance
 * (e.g., Host on ais-dev and Guest on ais-pre, or Cloud Run multi-instance).
 */
export class PeerJSGuestSession {
  private readonly roomCode: string;
  private readonly displayName: string;
  private readonly role: 'deaf' | 'hearing';
  private readonly callbacks: RtcSessionCallbacks;
  private localStream: MediaStream | null;
  private peer: Peer | null = null;
  private dataConn: DataConnection | null = null;
  private mediaCall: MediaConnection | null = null;
  private closed = false;

  constructor(params: {
    roomCode: string;
    displayName: string;
    role: 'deaf' | 'hearing';
    initialStream: MediaStream | null;
    callbacks: RtcSessionCallbacks;
  }) {
    this.roomCode = params.roomCode;
    this.displayName = params.displayName;
    this.role = params.role;
    this.localStream = params.initialStream;
    this.callbacks = params.callbacks;
  }

  async connect(camOn: boolean, micOn: boolean): Promise<void> {
    if (this.closed) return;
    this.callbacks.onPhaseChange('connecting_signal', 'Đang kết nối tới phòng gọi video...');
    const rtcCfg = await fetchRtcConfig();
    this.callbacks.onTurnConfigKnown(rtcCfg.turnConfigured);
    if (this.closed) return;

    const targetId = roomCodeToPeerId(this.roomCode);
    const peer = new Peer({
      debug: 0,
      config: { iceServers: rtcCfg.iceServers },
    });
    this.peer = peer;

    peer.on('open', () => {
      if (this.closed) return;
      const conn = peer.connect(targetId, { reliable: true });
      this.dataConn = conn;

      conn.on('open', () => {
        conn.send({
          type: 'guest-hello',
          displayName: this.displayName,
          role: this.role,
          camOn,
          micOn,
        });
        this.callbacks.onPhaseChange('negotiating', 'Đang liên hệ với chủ phòng...');
      });

      conn.on('data', (raw) => {
        const msg = raw as Record<string, unknown>;
        if (msg?.type === 'host-hello') {
          this.callbacks.onPeerChange({
            peerId: targetId,
            displayName: String(msg.displayName || 'Chủ phòng'),
            role: msg.role === 'deaf' ? 'deaf' : 'hearing',
            camOn: Boolean(msg.camOn),
            micOn: Boolean(msg.micOn),
          });
          if (msg.ready === false) {
            this.callbacks.onPhaseChange('waiting_peer', 'Chủ phòng đang chuẩn bị camera trong sảnh chờ...');
            return;
          }
          this.callbacks.onPhaseChange('negotiating', 'Đang thiết lập đường truyền video...');
          if (this.localStream && this.localStream.getTracks().length > 0) {
            try {
              this.mediaCall?.close();
            } catch {
              // ignore
            }
            const call = peer.call(targetId, this.localStream);
            this.attachMediaCall(call);
          } else {
            conn.send({ type: 'request-host-stream' });
          }
        } else if (msg?.type === 'caption' && msg.payload) {
          this.callbacks.onCaptionReceived(msg.payload as RtcCaptionPayload);
        } else if (msg?.type === 'media-state') {
          this.callbacks.onPeerChange({
            peerId: targetId,
            displayName: String(msg.displayName || 'Chủ phòng'),
            role: msg.role === 'deaf' ? 'deaf' : 'hearing',
            camOn: Boolean(msg.camOn),
            micOn: Boolean(msg.micOn),
          });
        } else if (msg?.type === 'room-ended') {
          this.callbacks.onRoomEnded(String(msg.reason || 'Cuộc gọi đã kết thúc.'));
        }
      });

      conn.on('close', () => {
        if (!this.closed) {
          this.callbacks.onPhaseChange('disconnected', 'Kết nối tới phòng đã đóng.');
        }
      });
    });

    peer.on('call', (incomingCall) => {
      incomingCall.answer(this.localStream || undefined);
      this.attachMediaCall(incomingCall);
    });

    peer.on('error', () => {
      if (!this.closed) {
        this.callbacks.onPhaseChange('failed', 'Không thể kết nối tới chủ phòng.');
      }
    });
  }

  private attachMediaCall(call: MediaConnection): void {
    this.mediaCall = call;
    call.on('stream', (remoteStream) => {
      this.callbacks.onRemoteStream(remoteStream);
      this.callbacks.onPhaseChange('connected', 'Đã kết nối P2P trực tiếp');
    });

    const pc = (call as unknown as { peerConnection?: RTCPeerConnection }).peerConnection;
    if (pc) {
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          this.callbacks.onPhaseChange('connected', 'Đã kết nối P2P trực tiếp');
        } else if (pc.connectionState === 'disconnected') {
          this.callbacks.onPhaseChange('reconnecting', 'Đường truyền đang chập chờn...');
        } else if (pc.connectionState === 'failed') {
          this.callbacks.onPhaseChange('failed', 'Kết nối WebRTC trực tiếp thất bại.');
        }
      };
    }

    call.on('close', () => {
      if (!this.closed) {
        this.callbacks.onRemoteStream(null);
        this.callbacks.onPhaseChange('waiting_peer', 'Đang chờ chủ phòng...');
      }
    });
  }

  sendCaption(payload: RtcCaptionPayload): void {
    if (this.dataConn?.open) {
      this.dataConn.send({ type: 'caption', payload });
    }
  }

  sendMediaState(camOn: boolean, micOn: boolean): void {
    if (this.dataConn?.open) {
      this.dataConn.send({
        type: 'media-state',
        displayName: this.displayName,
        role: this.role,
        camOn,
        micOn,
      });
    }
  }

  async replaceVideoTrack(newTrack: MediaStreamTrack | null, updatedStream: MediaStream | null): Promise<void> {
    this.localStream = updatedStream;
    const pc = (this.mediaCall as unknown as { peerConnection?: RTCPeerConnection })?.peerConnection;
    if (!pc) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  }

  async retryConnection(): Promise<void> {
    if (!this.peer || this.peer.destroyed) return;
    const targetId = roomCodeToPeerId(this.roomCode);
    if (this.localStream && this.localStream.getTracks().length > 0) {
      try {
        this.mediaCall?.close();
      } catch {
        // ignore
      }
      const call = this.peer.call(targetId, this.localStream);
      this.attachMediaCall(call);
      this.callbacks.onPhaseChange('negotiating', 'Đang thử kết nối lại P2P...');
    } else if (this.dataConn?.open) {
      this.dataConn.send({ type: 'request-host-stream' });
    }
  }

  disconnect(): void {
    this.closed = true;
    try {
      this.mediaCall?.close();
    } catch {
      // ignore
    }
    try {
      this.dataConn?.close();
    } catch {
      // ignore
    }
    try {
      this.peer?.destroy();
    } catch {
      // ignore
    }
    this.mediaCall = null;
    this.dataConn = null;
    this.peer = null;
  }
}

export class SignLensRtcSession {
  private readonly roomCode: string;
  private readonly clientId: string;
  private readonly displayName: string;
  private readonly role: 'deaf' | 'hearing';
  private readonly isHost: boolean;
  private readonly callbacks: RtcSessionCallbacks;

  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  private turnConfigured = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isOfferer = false;
  private closed = false;
  private hasRemotePeer = false;
  private reconnectAttempts = 0;
  private iceRestartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(params: {
    roomCode: string;
    clientId: string;
    displayName: string;
    role: 'deaf' | 'hearing';
    isHost?: boolean;
    initialStream: MediaStream | null;
    callbacks: RtcSessionCallbacks;
  }) {
    this.roomCode = params.roomCode;
    this.clientId = params.clientId;
    this.displayName = params.displayName;
    this.role = params.role;
    this.isHost = Boolean(params.isHost);
    this.localStream = params.initialStream;
    this.callbacks = params.callbacks;
  }

  hasActivePeer(): boolean {
    return this.hasRemotePeer;
  }

  async connect(camOn: boolean, micOn: boolean): Promise<void> {
    if (this.closed) return;
    this.callbacks.onPhaseChange('connecting_signal', 'Đang kết nối máy chủ tín hiệu...');

    const rtcCfg = await fetchRtcConfig();
    if (this.closed) return;
    this.iceServers = rtcCfg.iceServers;
    this.turnConfigured = rtcCfg.turnConfigured;
    this.callbacks.onTurnConfigKnown(rtcCfg.turnConfigured);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/signaling`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      if (this.closed) {
        ws.close();
        return;
      }
      this.sendSignal({
        type: 'join',
        roomCode: this.roomCode,
        clientId: this.clientId,
        displayName: this.displayName,
        role: this.role,
        isHost: this.isHost,
        camOn,
        micOn,
      });

      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendSignal({ type: 'ping' });
        }
      }, 15000);
    };

    ws.onmessage = async (event) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        return;
      }
      await this.handleSignalingMessage(msg);
    };

    ws.onerror = () => {
      if (!this.closed) {
        this.callbacks.onPhaseChange('failed', 'Mất kết nối tới máy chủ tín hiệu.');
        this.callbacks.onError('Không thể kết nối máy chủ signaling WebSocket.', 'SIGNALING_ERROR');
      }
    };

    ws.onclose = () => {
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      if (!this.closed) {
        this.callbacks.onPhaseChange('disconnected', 'Kết nối máy chủ tín hiệu đã đóng.');
      }
    };
  }

  private sendSignal(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private scheduleIceRestart(delayMs = 1000): void {
    if (this.iceRestartTimer) clearTimeout(this.iceRestartTimer);
    this.iceRestartTimer = setTimeout(() => {
      if (!this.closed && this.pc && this.pc.connectionState !== 'connected') {
        void this.retryConnection();
      }
    }, delayMs);
  }

  private ensurePeerConnection(): RTCPeerConnection {
    if (this.pc) return this.pc;

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 0,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
    this.pc = pc;
    this.remoteStream = new MediaStream();

    const localTracks = this.localStream ? this.localStream.getTracks() : [];
    const hasVideo = localTracks.some((t) => t.kind === 'video');
    const hasAudio = localTracks.some((t) => t.kind === 'audio');

    for (const track of localTracks) {
      if (this.localStream) {
        pc.addTrack(track, this.localStream);
      }
    }
    if (!hasVideo) {
      pc.addTransceiver('video', { direction: 'recvonly' });
    }
    if (!hasAudio) {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    pc.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((t) => {
          if (this.remoteStream && !this.remoteStream.getTracks().some((et) => et.id === t.id)) {
            this.remoteStream.addTrack(t);
          }
        });
      } else if (event.track) {
        if (!this.remoteStream.getTracks().some((et) => et.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
      }
      this.callbacks.onRemoteStream(this.remoteStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ondatachannel = (event) => {
      this.bindDataChannel(event.channel);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        this.reconnectAttempts = 0;
        this.callbacks.onPhaseChange('connected', 'Đã kết nối trực tiếp ổn định');
      } else if (state === 'connecting') {
        this.callbacks.onPhaseChange('negotiating', 'Đang thiết lập kết nối WebRTC...');
      } else if (state === 'disconnected') {
        this.callbacks.onPhaseChange('reconnecting', 'Đường truyền tạm gián đoạn, đang thử khôi phục...');
        this.scheduleIceRestart(1200);
      } else if (state === 'failed') {
        if (this.reconnectAttempts < 3 && !this.closed) {
          this.reconnectAttempts++;
          this.callbacks.onPhaseChange('reconnecting', `Đang tự động khôi phục kết nối (lần ${this.reconnectAttempts}/3)...`);
          this.scheduleIceRestart(800);
        } else {
          const reason = this.turnConfigured
            ? 'Kết nối WebRTC thất bại qua NAT/tường lửa. Bấm "Thử kết nối lại" bên dưới.'
            : 'Kết nối trực tiếp thất bại giữa hai mạng khác nhau (chưa có TURN relay).';
          this.callbacks.onPhaseChange('failed', reason);
        }
      } else if (state === 'closed') {
        this.callbacks.onPhaseChange('disconnected', 'Cuộc gọi đã ngắt kết nối.');
      }
    };

    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      if (iceState === 'connected' || iceState === 'completed') {
        this.reconnectAttempts = 0;
        this.callbacks.onPhaseChange('connected', 'Đã kết nối trực tiếp ổn định');
      } else if (iceState === 'failed') {
        if (this.reconnectAttempts < 3 && !this.closed) {
          this.reconnectAttempts++;
          this.callbacks.onPhaseChange('reconnecting', `Đang tự động khôi phục kết nối (lần ${this.reconnectAttempts}/3)...`);
          this.scheduleIceRestart(800);
        } else {
          const reason = this.turnConfigured
            ? 'Không thể thiết lập đường truyền ICE giữa hai thiết bị.'
            : 'Không thể xuyên NAT trực tiếp giữa hai mạng (cần cấu hình TURN relay).';
          this.callbacks.onPhaseChange('failed', reason);
        }
      }
    };

    return pc;
  }

  private bindDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as {
          type?: string;
          payload?: RtcCaptionPayload;
        };
        if (data?.type === 'caption' && data.payload?.text) {
          this.callbacks.onCaptionReceived(data.payload);
        }
      } catch {
        // ignore malformed packets
      }
    };
  }

  private closePeerConnection(): void {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {
        // ignore
      }
      this.dataChannel = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }
    this.pendingCandidates = [];
    this.remoteStream = null;
    this.isOfferer = false;
    this.callbacks.onRemoteStream(null);
  }

  private async flushPendingCandidates(): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) return;
    const queued = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const cand of queued) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // ignore stale candidate
      }
    }
  }

  private async handleSignalingMessage(msg: Record<string, unknown>): Promise<void> {
    const type = typeof msg.type === 'string' ? msg.type : '';

    if (type === 'pong') return;

    if (type === 'error') {
      const message = typeof msg.message === 'string' ? msg.message : 'Lỗi phòng gọi video.';
      const code = typeof msg.code === 'string' ? msg.code : undefined;
      this.callbacks.onError(message, code);
      this.callbacks.onPhaseChange('failed', message);
      return;
    }

    if (type === 'room-joined') {
      const peers = Array.isArray(msg.peers) ? (msg.peers as PeerMeta[]) : [];
      if (peers.length === 0) {
        this.hasRemotePeer = false;
        this.callbacks.onPeerChange(null);
        this.callbacks.onPhaseChange('waiting_peer', 'Đang chờ người tham gia...');
      } else {
        this.hasRemotePeer = true;
        this.callbacks.onPeerChange(peers[0]);
        this.callbacks.onPhaseChange('negotiating', 'Đã tìm thấy người tham gia, đang kết nối...');
      }
      return;
    }

    if (type === 'peer-joined') {
      const peer: PeerMeta = {
        peerId: String(msg.peerId || ''),
        displayName: String(msg.displayName || 'Người tham gia'),
        role: msg.role === 'deaf' ? 'deaf' : 'hearing',
        camOn: Boolean(msg.camOn),
        micOn: Boolean(msg.micOn),
      };
      this.hasRemotePeer = true;
      this.callbacks.onPeerChange(peer);
      this.callbacks.onPhaseChange('negotiating', 'Người tham gia đã vào phòng, đang thiết lập WebRTC...');

      if (msg.shouldCreateOffer) {
        this.closePeerConnection();
        this.isOfferer = true;
        const pc = this.ensurePeerConnection();
        const dc = pc.createDataChannel('signlens-subtitles', { ordered: true });
        this.bindDataChannel(dc);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.sendSignal({ type: 'offer', sdp: pc.localDescription });
        } catch {
          this.callbacks.onError('Không thể khởi tạo phiên WebRTC Offer.');
        }
      }
      return;
    }

    if (type === 'offer') {
      this.closePeerConnection();
      this.isOfferer = false;
      const pc = this.ensurePeerConnection();
      this.callbacks.onPhaseChange('negotiating', 'Đang phản hồi kết nối WebRTC...');
      try {
        const sdp = msg.sdp as RTCSessionDescriptionInit;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await this.flushPendingCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal({ type: 'answer', sdp: pc.localDescription });
      } catch {
        this.callbacks.onError('Không thể xử lý tín hiệu cuộc gọi đến.');
      }
      return;
    }

    if (type === 'answer') {
      if (!this.pc) return;
      try {
        const sdp = msg.sdp as RTCSessionDescriptionInit;
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await this.flushPendingCandidates();
      } catch {
        // ignore duplicate answer
      }
      return;
    }

    if (type === 'ice-candidate') {
      const cand = msg.candidate as RTCIceCandidateInit | undefined;
      if (!cand) return;
      if (!this.pc || !this.pc.remoteDescription) {
        this.pendingCandidates.push(cand);
      } else {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {
          // ignore
        }
      }
      return;
    }

    if (type === 'caption') {
      const payload = msg.payload as RtcCaptionPayload | undefined;
      if (payload?.text) {
        this.callbacks.onCaptionReceived(payload);
      }
      return;
    }

    if (type === 'media-state') {
      this.callbacks.onPeerChange({
        peerId: String(msg.from || ''),
        displayName: String(msg.displayName || 'Người tham gia'),
        role: msg.role === 'deaf' ? 'deaf' : 'hearing',
        camOn: Boolean(msg.camOn),
        micOn: Boolean(msg.micOn),
      });
      return;
    }

    if (type === 'peer-left') {
      this.hasRemotePeer = false;
      this.closePeerConnection();
      this.callbacks.onPeerChange(null);
      this.callbacks.onPhaseChange('waiting_peer', 'Người kia đã rời phòng. Đang chờ kết nối lại...');
      return;
    }

    if (type === 'room-ended') {
      const reason = typeof msg.reason === 'string' ? msg.reason : 'Cuộc gọi đã kết thúc.';
      this.hasRemotePeer = false;
      this.closePeerConnection();
      this.callbacks.onRoomEnded(reason);
    }
  }

  sendCaption(payload: RtcCaptionPayload): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'caption', payload }));
        return;
      } catch {
        // fall through to WS relay
      }
    }
    this.sendSignal({ type: 'caption', payload });
  }

  sendMediaState(camOn: boolean, micOn: boolean): void {
    this.sendSignal({
      type: 'media-state',
      displayName: this.displayName,
      role: this.role,
      camOn,
      micOn,
    });
  }

  async replaceVideoTrack(newTrack: MediaStreamTrack | null, updatedStream: MediaStream | null): Promise<void> {
    this.localStream = updatedStream;
    if (!this.pc) return;
    const videoSender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    if (videoSender) {
      await videoSender.replaceTrack(newTrack);
    } else if (newTrack && updatedStream) {
      this.pc.addTrack(newTrack, updatedStream);
    }
  }

  async retryConnection(): Promise<void> {
    if (!this.pc || this.closed) return;
    try {
      this.callbacks.onPhaseChange('reconnecting', 'Đang thiết lập lại kết nối WebRTC...');
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      this.sendSignal({ type: 'offer', sdp: this.pc.localDescription });
    } catch {
      // In case creating offer fails, fallback to signal notify
      this.sendSignal({ type: 'media-state', camOn: true, micOn: true });
    }
  }

  disconnect(endRoomForAll = false): void {
    this.closed = true;
    this.hasRemotePeer = false;
    if (this.iceRestartTimer) {
      clearTimeout(this.iceRestartTimer);
      this.iceRestartTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSignal({ type: endRoomForAll ? 'end-room' : 'leave' });
    }
    this.closePeerConnection();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }
}
