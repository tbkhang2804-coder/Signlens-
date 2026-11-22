import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const DIST_DIR = path.resolve(__dirname, 'dist');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SESSION_SECRET = process.env.SIGNLENS_SECRET || crypto.randomBytes(32).toString('hex');

function resolveDataPath(filename: string): string {
  const safeName = path.basename(filename);
  const resolved = path.resolve(DATA_DIR, safeName);
  if (!resolved.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid data file path');
  }
  return resolved;
}

function readJsonFile<T>(filename: string, defaultValue: T): T {
  const filePath = resolveDataPath(filename);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return defaultValue;
  }
}

function writeJsonFile<T>(filename: string, value: T): void {
  const filePath = resolveDataPath(filename);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

interface AdminCredentialStore {
  username: string;
  salt: string;
  passwordHash: string;
  fullName: string;
  createdAt: string;
}

interface SignRecord {
  id: string;
  language: string;
  label: string;
  meaning_vi: string;
  meaning_original: string;
  category: string;
  media_url: string;
  media_type: string;
  landmarks_sequence: unknown[];
  landmarks_count: number;
  source: string;
  license: string;
  moderation_status: 'approved' | 'pending' | 'rejected';
  moderation_notes: string;
  created_at: string;
  updated_at: string;
}

interface AuthTokenPayload {
  userId: string;
  username: string;
  role: 'admin';
  fullName: string;
  iat: number;
  exp: number;
}

const DEFAULT_SIGNS: SignRecord[] = [
  {
    id: 'srv_xin_chao',
    language: 'VSL',
    label: 'XIN_CHAO',
    meaning_vi: 'Xin chào',
    meaning_original: 'Xin chào',
    category: 'chào_hỏi',
    media_url: 'https://www.youtube.com/watch?v=k3T3Z6sM8yA',
    media_type: 'youtube',
    landmarks_sequence: [],
    landmarks_count: 0,
    source: 'Thư viện chuẩn SignLens',
    license: 'CC-BY-SA 4.0',
    moderation_status: 'approved',
    moderation_notes: 'Mẫu chào hỏi cơ bản VSL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'srv_cam_on',
    language: 'VSL',
    label: 'CAM_ON',
    meaning_vi: 'Cảm ơn',
    meaning_original: 'Cảm ơn',
    category: 'chào_hỏi',
    media_url: 'https://www.youtube.com/watch?v=7wtfhZwyrcc',
    media_type: 'youtube',
    landmarks_sequence: [],
    landmarks_count: 0,
    source: 'Thư viện chuẩn SignLens',
    license: 'CC-BY-SA 4.0',
    moderation_status: 'approved',
    moderation_notes: 'Mẫu cảm ơn lịch sự',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function hashPasswordScrypt(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function timingSafeStringMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createAuthToken(payload: Omit<AuthTokenPayload, 'iat' | 'exp'>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: nowSec,
      exp: nowSec + 24 * 60 * 60,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyAuthToken(token: string): AuthTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  if (!timingSafeStringMatch(signature, expectedSig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthTokenPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getRequestAdmin(req: express.Request): AuthTokenPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyAuthToken(authHeader.slice(7).trim());
}

function getEnvAdminPasscode(): string {
  return (process.env.SIGNLENS_ADMIN_PASSWORD || '').trim();
}

function getSavedAdmin(): AdminCredentialStore | null {
  const store = readJsonFile<AdminCredentialStore | null>('admin_auth.json', null);
  return store && store.passwordHash ? store : null;
}

const SIGNLENS_SYSTEM_INSTRUCTION = `Bạn là SignBot — trợ lý ảo thân thiện của nền tảng SignLens ("PHÁ BỎ RÀO CẢN GIAO TIẾP").
SignLens là nền tảng hỗ trợ giao tiếp giữa người khiếm thính và người nghe thông qua cuộc gọi video hai thiết bị, nhận diện ngôn ngữ ký hiệu Việt Nam (VSL), văn bản và phụ đề:
1. Trang chủ: Giới thiệu sứ mệnh kết nối bằng ngôn ngữ ký hiệu và 4 trụ cột tính năng chính.
2. Kết nối cuộc gọi & Gọi video 2 thiết bị: Tạo phòng gọi video (mã phòng dễ đọc, QR mời, sao chép/chia sẻ liên kết), tham gia phòng bằng mã hoặc quét QR, kiểm tra camera/micro trước khi vào phòng, gọi video WebRTC hai chiều kèm phụ đề trực tiếp, nhận diện ký hiệu VSL và chat văn bản.
3. Học ký hiệu VSL: Mô phỏng bàn tay 2D theo từng nhịp, bảng chữ cái tiếng Việt, đấu trường trắc nghiệm và thư viện video YouTube.
4. Phụ đề & Giao tiếp văn bản: Tóm tắt văn bản/giấy tờ sang VSL và tạo phụ đề .SRT.
5. Tài khoản & Studio AI: Quản trị bài học, đo khớp bàn tay và huấn luyện mẫu VSL riêng bằng k-NN trên trình duyệt.

Quy tắc trả lời:
- Luôn trả lời bằng tiếng Việt rõ ràng, lịch sự, súc tích (tối đa 4-6 câu hoặc gạch đầu dòng ngắn gọn).
- Không bịa đặt số liệu độ chính xác hay tính năng không có trong SignLens (không nhắc đến Giao tiếp 1 máy, SOS, Radar âm thanh, Quét vật cản hay Chế độ Offline).
- Nếu người dùng hỏi cách tạo phòng, quét QR, cấp quyền camera/micro hoặc dùng phụ đề trong cuộc gọi, hãy hướng dẫn cụ thể từng bước.`;

interface RoomParticipant {
  clientId: string;
  ws: WebSocket;
  displayName: string;
  role: 'deaf' | 'hearing';
  joinedAt: number;
  camOn: boolean;
  micOn: boolean;
}

interface CallRoom {
  code: string;
  status: 'waiting' | 'active' | 'ended';
  createdAt: number;
  expiresAt: number;
  endedAt?: number;
  participants: Map<string, RoomParticipant>;
}

const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const ENDED_RETENTION_MS = 30 * 60 * 1000;
const callRooms = new Map<string, CallRoom>();

function normalizeRoomCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('SL-')) {
    return cleaned.slice(0, 12);
  }
  const withoutPrefix = cleaned.startsWith('SL') ? cleaned.slice(2) : cleaned;
  if (!withoutPrefix || withoutPrefix.length < 3) return '';
  return `SL-${withoutPrefix.slice(0, 8)}`;
}

function createUniqueRoomCode(): string {
  for (let i = 0; i < 20; i++) {
    const num = Math.floor(1000 + Math.random() * 9000);
    const code = `SL-${num}`;
    if (!callRooms.has(code)) return code;
  }
  return `SL-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function purgeExpiredRooms(): void {
  const now = Date.now();
  for (const [code, room] of callRooms.entries()) {
    if (room.status === 'ended') {
      if (room.endedAt && now - room.endedAt > ENDED_RETENTION_MS) {
        callRooms.delete(code);
      }
      continue;
    }
    if (now > room.expiresAt && room.participants.size === 0) {
      callRooms.delete(code);
    }
  }
}

let cachedMeteredIce: { expiresAt: number; servers: Array<Record<string, unknown>> } | null = null;

async function getIceServersConfig(): Promise<{
  iceServers: Array<Record<string, unknown>>;
  turnConfigured: boolean;
}> {
  const iceServers: Array<Record<string, unknown>> = [
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
  ];

  let turnConfigured = false;

  // 1. Direct JSON array via TURN_ICE_SERVERS_JSON
  const rawJson = (process.env.TURN_ICE_SERVERS_JSON || '').trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry && typeof entry === 'object' && 'urls' in entry) {
            iceServers.push(entry as Record<string, unknown>);
            const u = String((entry as { urls?: unknown }).urls || '');
            if (u.includes('turn:') || u.includes('turns:')) {
              turnConfigured = true;
            }
          }
        }
      }
    } catch {
      console.warn('Invalid TURN_ICE_SERVERS_JSON ignored');
    }
  }

  // 2. Standard TURN_URL + TURN_USERNAME + TURN_CREDENTIAL
  const turnUrl = (process.env.TURN_URL || '').trim();
  const turnUsername = (process.env.TURN_USERNAME || '').trim();
  const turnCredential = (process.env.TURN_CREDENTIAL || '').trim();

  if (turnUrl) {
    const urls = turnUrl
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    for (const u of urls) {
      const turnEntry: Record<string, unknown> = { urls: u };
      if (u.startsWith('turn:') || u.startsWith('turns:')) {
        if (turnUsername) turnEntry.username = turnUsername;
        if (turnCredential) turnEntry.credential = turnCredential;
        turnConfigured = true;
      }
      iceServers.push(turnEntry);
    }
  }

  // 3. Metered.ca dynamic TURN API (METERED_TURN_DOMAIN + METERED_API_KEY)
  const meteredDomain = (process.env.METERED_TURN_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const meteredKey = (process.env.METERED_API_KEY || '').trim();
  if (meteredDomain && meteredKey) {
    const now = Date.now();
    if (cachedMeteredIce && cachedMeteredIce.expiresAt > now) {
      iceServers.push(...cachedMeteredIce.servers);
      if (cachedMeteredIce.servers.length > 0) turnConfigured = true;
    } else {
      try {
        const resp = await fetch(
          `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(meteredKey)}`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (resp.ok) {
          const list = (await resp.json()) as Array<Record<string, unknown>>;
          if (Array.isArray(list) && list.length > 0) {
            const turnOnly = list.filter((item) => {
              const u = String(item?.urls || '');
              return u.includes('turn:') || u.includes('turns:');
            });
            cachedMeteredIce = {
              expiresAt: now + 5 * 60 * 1000,
              servers: turnOnly,
            };
            iceServers.push(...turnOnly);
            if (turnOnly.length > 0) turnConfigured = true;
          }
        }
      } catch (err) {
        console.warn('Metered TURN fetch failed:', err instanceof Error ? err.message : err);
      }
    }
  }

  return { iceServers, turnConfigured };
}

function sendWsJson(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Ensure initial signs store exists
  readJsonFile<SignRecord[]>('signs.json', DEFAULT_SIGNS);

  // 1. Gemini Chatbot Endpoint
  app.post('/api/chat', async (req, res) => {
    const rawMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];

    if (!rawMessage) {
      return res.status(400).json({ error: 'Vui lòng nhập nội dung câu hỏi.' });
    }
    if (rawMessage.length > 1500) {
      return res.status(400).json({ error: 'Câu hỏi quá dài (tối đa 1500 ký tự).' });
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({
        error: 'Gemini API key chưa được cấu hình trên máy chủ.',
        fallbackRequired: true,
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const conversationContext = history
        .map((m: { sender?: string; text?: string }) => {
          const who = m?.sender === 'user' ? 'Người dùng' : 'SignBot';
          const text = typeof m?.text === 'string' ? m.text.slice(0, 400) : '';
          return text ? `${who}: ${text}` : '';
        })
        .filter(Boolean)
        .join('\n');

      const prompt = conversationContext
        ? `Ngữ cảnh hội thoại gần đây:\n${conversationContext}\n\nCâu hỏi mới của người dùng: ${rawMessage}`
        : rawMessage;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: SIGNLENS_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const replyText = (response.text || '').trim();
      if (!replyText) {
        return res.status(502).json({
          error: 'Không nhận được nội dung phản hồi từ mô hình.',
          fallbackRequired: true,
        });
      }

      return res.json({
        reply: replyText,
        source: 'gemini',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối Gemini API';
      console.error('Gemini /api/chat error:', msg);
      return res.status(502).json({
        error: msg,
        fallbackRequired: true,
      });
    }
  });

  // 2. Auth & First-Run Claim Routes
  app.get('/api/auth/status', (_req, res) => {
    const envPass = getEnvAdminPasscode();
    const saved = getSavedAdmin();
    return res.json({
      configured: Boolean(envPass || saved),
      source: envPass ? 'env' : saved ? 'claimed' : 'unclaimed',
      username: saved?.username || 'admin',
    });
  });

  app.post('/api/auth/setup', (req, res) => {
    if (getEnvAdminPasscode() || getSavedAdmin()) {
      return res.status(409).json({
        success: false,
        error: 'Tài khoản quản trị đã được thiết lập trước đó.',
      });
    }

    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : 'admin';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || username.length < 3 || username.length > 32) {
      return res.status(400).json({
        success: false,
        error: 'Tên đăng nhập cần từ 3 đến 32 ký tự.',
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Mật khẩu quản trị cần ít nhất 6 ký tự.',
      });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPasswordScrypt(password, salt);
    const adminRecord: AdminCredentialStore = {
      username,
      salt,
      passwordHash,
      fullName: 'Quản trị viên SignLens',
      createdAt: new Date().toISOString(),
    };
    writeJsonFile('admin_auth.json', adminRecord);

    const token = createAuthToken({
      userId: 'admin_1',
      username: adminRecord.username,
      role: 'admin',
      fullName: adminRecord.fullName,
    });

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: 'admin_1',
        username: adminRecord.username,
        role: 'admin',
        fullName: adminRecord.fullName,
      },
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ tên đăng nhập và mật khẩu.',
      });
    }

    const envPass = getEnvAdminPasscode();
    const saved = getSavedAdmin();

    if (!envPass && !saved) {
      return res.status(412).json({
        success: false,
        needsSetup: true,
        error: 'Hệ thống chưa thiết lập mật khẩu quản trị ban đầu.',
      });
    }

    if (envPass) {
      if (username !== 'admin' || !timingSafeStringMatch(password, envPass)) {
        return res.status(401).json({
          success: false,
          error: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        });
      }
      const token = createAuthToken({
        userId: 'admin_env',
        username: 'admin',
        role: 'admin',
        fullName: 'Quản trị viên SignLens',
      });
      return res.json({
        success: true,
        token,
        user: {
          id: 'admin_env',
          username: 'admin',
          role: 'admin',
          fullName: 'Quản trị viên SignLens',
        },
      });
    }

    if (saved) {
      const candidateHash = hashPasswordScrypt(password, saved.salt);
      if (username !== saved.username || !timingSafeStringMatch(candidateHash, saved.passwordHash)) {
        return res.status(401).json({
          success: false,
          error: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        });
      }
      const token = createAuthToken({
        userId: 'admin_1',
        username: saved.username,
        role: 'admin',
        fullName: saved.fullName,
      });
      return res.json({
        success: true,
        token,
        user: {
          id: 'admin_1',
          username: saved.username,
          role: 'admin',
          fullName: saved.fullName,
        },
      });
    }

    return res.status(401).json({ success: false, error: 'Xác thực thất bại.' });
  });

  app.get('/api/auth/me', (req, res) => {
    const authUser = getRequestAdmin(req);
    if (!authUser) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: 'Chưa xác thực hoặc phiên hết hạn.',
      });
    }
    return res.json({ success: true, authenticated: true, user: authUser });
  });

  // 3. Public Signs Catalog
  app.get('/api/signs', (req, res) => {
    const signs = readJsonFile<SignRecord[]>('signs.json', DEFAULT_SIGNS);
    const lang = typeof req.query.lang === 'string' ? req.query.lang : '';
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase().trim() : '';

    let filtered = signs.filter((s) => s.moderation_status === 'approved');
    if (lang && lang !== 'all') filtered = filtered.filter((s) => s.language === lang);
    if (category && category !== 'all') filtered = filtered.filter((s) => s.category === category);
    if (search) {
      filtered = filtered.filter(
        (s) =>
          s.label.toLowerCase().includes(search) ||
          s.meaning_vi.toLowerCase().includes(search) ||
          s.meaning_original.toLowerCase().includes(search)
      );
    }

    return res.json({ success: true, total: filtered.length, data: filtered });
  });

  // 4. Protected Admin APIs
  app.use('/api/admin', (req, res, next) => {
    const authUser = getRequestAdmin(req);
    if (!authUser || authUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Yêu cầu quyền quản trị viên Admin đã đăng nhập.',
      });
    }
    next();
  });

  app.get('/api/admin/signs', (_req, res) => {
    const signs = readJsonFile<SignRecord[]>('signs.json', DEFAULT_SIGNS);
    return res.json({ success: true, total: signs.length, data: signs });
  });

  app.post('/api/admin/signs', (req, res) => {
    const body = req.body || {};
    const label = typeof body.label === 'string' ? body.label.trim().toUpperCase() : '';
    const meaningVi = typeof body.meaning_vi === 'string' ? body.meaning_vi.trim() : '';
    const language = typeof body.language === 'string' ? body.language.trim() : 'VSL';

    if (!label || !meaningVi) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu nhãn ký hiệu hoặc ý nghĩa tiếng Việt.',
      });
    }

    const signs = readJsonFile<SignRecord[]>('signs.json', DEFAULT_SIGNS);
    const mediaUrl = typeof body.media_url === 'string' ? body.media_url.trim() : '';
    const newSign: SignRecord = {
      id: crypto.randomUUID(),
      language,
      label,
      meaning_vi: meaningVi,
      meaning_original: typeof body.meaning_original === 'string' ? body.meaning_original.trim() : meaningVi,
      category: typeof body.category === 'string' ? body.category : 'khác',
      media_url: mediaUrl,
      media_type:
        typeof body.media_type === 'string'
          ? body.media_type
          : mediaUrl.includes('youtube') || mediaUrl.includes('youtu.be')
            ? 'youtube'
            : 'video',
      landmarks_sequence: Array.isArray(body.landmarks_sequence) ? body.landmarks_sequence : [],
      landmarks_count: Array.isArray(body.landmarks_sequence) ? body.landmarks_sequence.length : 0,
      source: typeof body.source === 'string' ? body.source.trim() : 'Quản trị SignLens',
      license: 'CC-BY-SA 4.0',
      moderation_status:
        body.moderation_status === 'pending' || body.moderation_status === 'rejected'
          ? body.moderation_status
          : 'approved',
      moderation_notes: typeof body.moderation_notes === 'string' ? body.moderation_notes.trim() : '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    signs.unshift(newSign);
    writeJsonFile('signs.json', signs);
    return res.status(201).json({ success: true, data: newSign });
  });

  app.put('/api/admin/signs/:id', (req, res) => {
    const signId = req.params.id;
    const signs = readJsonFile<SignRecord[]>('signs.json', DEFAULT_SIGNS);
    const idx = signs.findIndex((s) => s.id === signId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy mẫu ký hiệu.' });
    }
    const existing = signs[idx];
    const body = req.body || {};
    const updated: SignRecord = {
      ...existing,
      language: typeof body.language === 'string' ? body.language : existing.language,
      label: typeof body.label === 'string' ? body.label.trim().toUpperCase() : existing.label,
      meaning_vi: typeof body.meaning_vi === 'string' ? body.meaning_vi.trim() : existing.meaning_vi,
      category: typeof body.category === 'string' ? body.category : existing.category,
      moderation_status:
        body.moderation_status === 'approved' ||
        body.moderation_status === 'pending' ||
        body.moderation_status === 'rejected'
          ? body.moderation_status
          : existing.moderation_status,
      moderation_notes:
        typeof body.moderation_notes === 'string' ? body.moderation_notes : existing.moderation_notes,
      updated_at: new Date().toISOString(),
    };
    signs[idx] = updated;
    writeJsonFile('signs.json', signs);
    return res.json({ success: true, data: updated });
  });

  app.delete('/api/admin/signs/:id', (req, res) => {
    const signId = req.params.id;
    const signs = readJsonFile<SignRecord[]>('signs.json', DEFAULT_SIGNS);
    const next = signs.filter((s) => s.id !== signId);
    if (next.length === signs.length) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy mẫu ký hiệu để xóa.' });
    }
    writeJsonFile('signs.json', next);
    return res.json({ success: true, deletedId: signId });
  });

  app.get('/api/admin/stats', (_req, res) => {
    const signs = readJsonFile<SignRecord[]>('signs.json', DEFAULT_SIGNS);
    return res.json({
      success: true,
      data: {
        totalDatabaseRecords: signs.length,
        byLanguage: {
          VSL: signs.filter((s) => s.language === 'VSL').length,
          ASL: signs.filter((s) => s.language === 'ASL').length,
          BSL: signs.filter((s) => s.language === 'BSL').length,
        },
        byStatus: {
          approved: signs.filter((s) => s.moderation_status === 'approved').length,
          pending: signs.filter((s) => s.moderation_status === 'pending').length,
          rejected: signs.filter((s) => s.moderation_status === 'rejected').length,
        },
      },
    });
  });

  // 5. WebRTC Room & ICE Config APIs
  app.get('/api/rtc-config', async (_req, res) => {
    const config = await getIceServersConfig();
    return res.json({
      success: true,
      ...config,
    });
  });

  app.post('/api/rooms', (_req, res) => {
    purgeExpiredRooms();
    const code = createUniqueRoomCode();
    const now = Date.now();
    const room: CallRoom = {
      code,
      status: 'waiting',
      createdAt: now,
      expiresAt: now + ROOM_TTL_MS,
      participants: new Map(),
    };
    callRooms.set(code, room);

    return res.status(201).json({
      success: true,
      room: {
        code: room.code,
        status: room.status,
        participantCount: 0,
        createdAt: new Date(room.createdAt).toISOString(),
        expiresAt: new Date(room.expiresAt).toISOString(),
      },
    });
  });

  app.get('/api/rooms/:code', (req, res) => {
    purgeExpiredRooms();
    const normalized = normalizeRoomCode(req.params.code || '');
    if (!normalized) {
      return res.status(400).json({
        exists: false,
        status: 'invalid',
        error: 'Mã phòng không hợp lệ. Vui lòng nhập mã dạng SL-1234.',
      });
    }

    const room = callRooms.get(normalized);
    if (!room) {
      return res.status(404).json({
        exists: false,
        status: 'not_found',
        error: 'Phòng không tồn tại hoặc đã hết hạn.',
      });
    }

    if (room.status === 'ended') {
      return res.json({
        exists: true,
        code: room.code,
        status: 'ended',
        participantCount: 0,
        full: false,
        createdAt: new Date(room.createdAt).toISOString(),
        expiresAt: new Date(room.expiresAt).toISOString(),
      });
    }

    return res.json({
      exists: true,
      code: room.code,
      status: room.participants.size >= 2 ? 'active' : 'waiting',
      participantCount: room.participants.size,
      full: room.participants.size >= 2,
      createdAt: new Date(room.createdAt).toISOString(),
      expiresAt: new Date(room.expiresAt).toISOString(),
    });
  });

  app.post('/api/rooms/:code/end', (req, res) => {
    const normalized = normalizeRoomCode(req.params.code || '');
    const room = normalized ? callRooms.get(normalized) : undefined;
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy phòng gọi video.',
      });
    }

    room.status = 'ended';
    room.endedAt = Date.now();
    for (const participant of room.participants.values()) {
      sendWsJson(participant.ws, {
        type: 'room-ended',
        roomCode: room.code,
        reason: 'Phòng gọi video đã được kết thúc.',
      });
    }
    room.participants.clear();

    return res.json({ success: true, code: room.code, status: 'ended' });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, status: 'healthy' });
  });

  // Vite dev middleware vs Production static serving
  const hasBuiltDist = fs.existsSync(path.join(DIST_DIR, 'index.html'));
  const isDevRuntime =
    process.env.NODE_ENV === 'development' ||
    process.execArgv.some((arg) => arg.includes('tsx'));
  const isProd =
    process.env.NODE_ENV === 'production' ||
    (hasBuiltDist && !isDevRuntime);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_DIR, { maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (reqUrl.pathname === '/ws/signaling') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    let joinedRoomCode = '';
    let joinedClientId = '';

    const detachFromRoom = (notifyPeers: boolean) => {
      if (!joinedRoomCode || !joinedClientId) return;
      const room = callRooms.get(joinedRoomCode);
      if (room) {
        room.participants.delete(joinedClientId);
        if (room.status !== 'ended') {
          room.status = room.participants.size >= 2 ? 'active' : 'waiting';
          if (notifyPeers) {
            for (const other of room.participants.values()) {
              sendWsJson(other.ws, {
                type: 'peer-left',
                roomCode: room.code,
                peerId: joinedClientId,
              });
            }
          }
        }
      }
      joinedRoomCode = '';
      joinedClientId = '';
    };

    ws.on('message', (rawBuf) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawBuf.toString('utf8')) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = typeof msg.type === 'string' ? msg.type : '';

      if (type === 'ping') {
        sendWsJson(ws, { type: 'pong', ts: Date.now() });
        return;
      }

      if (type === 'join') {
        purgeExpiredRooms();
        const code = normalizeRoomCode(typeof msg.roomCode === 'string' ? msg.roomCode : '');
        const clientId =
          typeof msg.clientId === 'string' && msg.clientId.trim()
            ? msg.clientId.trim().slice(0, 64)
            : crypto.randomUUID();
        const displayName =
          typeof msg.displayName === 'string' && msg.displayName.trim()
            ? msg.displayName.trim().slice(0, 48)
            : 'Thành viên';
        const role = msg.role === 'deaf' ? 'deaf' : 'hearing';
        const camOn = Boolean(msg.camOn);
        const micOn = Boolean(msg.micOn);

        if (!code) {
          sendWsJson(ws, {
            type: 'error',
            code: 'INVALID_CODE',
            message: 'Mã phòng không hợp lệ.',
          });
          return;
        }

        let room = callRooms.get(code);
        if (!room && msg.isHost === true) {
          const now = Date.now();
          room = {
            code,
            status: 'waiting',
            createdAt: now,
            expiresAt: now + ROOM_TTL_MS,
            participants: new Map(),
          };
          callRooms.set(code, room);
        }
        if (!room) {
          sendWsJson(ws, {
            type: 'error',
            code: 'ROOM_NOT_FOUND',
            message: 'Phòng không tồn tại hoặc đã hết hạn.',
          });
          return;
        }

        if (room.status === 'ended') {
          sendWsJson(ws, {
            type: 'error',
            code: 'ROOM_ENDED',
            message: 'Cuộc gọi tại phòng này đã kết thúc.',
          });
          return;
        }

        if (room.participants.size >= 2 && !room.participants.has(clientId)) {
          sendWsJson(ws, {
            type: 'error',
            code: 'ROOM_FULL',
            message: 'Phòng này đã đủ 2 người tham gia.',
          });
          return;
        }

        if (joinedRoomCode && joinedRoomCode !== code) {
          detachFromRoom(true);
        }

        const existingPeers = Array.from(room.participants.values()).filter(
          (p) => p.clientId !== clientId
        );

        room.participants.set(clientId, {
          clientId,
          ws,
          displayName,
          role,
          joinedAt: Date.now(),
          camOn,
          micOn,
        });
        room.status = room.participants.size >= 2 ? 'active' : 'waiting';
        joinedRoomCode = code;
        joinedClientId = clientId;

        sendWsJson(ws, {
          type: 'room-joined',
          roomCode: code,
          clientId,
          status: room.status,
          peers: existingPeers.map((p) => ({
            peerId: p.clientId,
            displayName: p.displayName,
            role: p.role,
            camOn: p.camOn,
            micOn: p.micOn,
          })),
        });

        for (const peer of existingPeers) {
          sendWsJson(peer.ws, {
            type: 'peer-joined',
            roomCode: code,
            peerId: clientId,
            displayName,
            role,
            camOn,
            micOn,
            shouldCreateOffer: true,
          });
        }
        return;
      }

      if (!joinedRoomCode || !joinedClientId) return;
      const room = callRooms.get(joinedRoomCode);
      if (!room) return;

      if (type === 'leave') {
        detachFromRoom(true);
        return;
      }

      if (type === 'end-room') {
        room.status = 'ended';
        room.endedAt = Date.now();
        for (const peer of room.participants.values()) {
          if (peer.clientId !== joinedClientId) {
            sendWsJson(peer.ws, {
              type: 'room-ended',
              roomCode: room.code,
              by: joinedClientId,
              reason: 'Người tham gia kia đã kết thúc cuộc gọi.',
            });
          }
        }
        room.participants.clear();
        joinedRoomCode = '';
        joinedClientId = '';
        return;
      }

      if (type === 'media-state') {
        const self = room.participants.get(joinedClientId);
        if (self) {
          self.camOn = Boolean(msg.camOn);
          self.micOn = Boolean(msg.micOn);
        }
      }

      if (
        type === 'offer' ||
        type === 'answer' ||
        type === 'ice-candidate' ||
        type === 'caption' ||
        type === 'media-state'
      ) {
        for (const peer of room.participants.values()) {
          if (peer.clientId !== joinedClientId) {
            sendWsJson(peer.ws, {
              ...msg,
              from: joinedClientId,
              roomCode: room.code,
            });
          }
        }
      }
    });

    ws.on('close', () => {
      detachFromRoom(true);
    });
  });

  const wsHeartbeatTimer = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.ping();
      }
    }
  }, 20000);
  wsHeartbeatTimer.unref?.();

  const purgeTimer = setInterval(purgeExpiredRooms, 5 * 60 * 1000);
  purgeTimer.unref?.();

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SignLens full-stack server running on http://localhost:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start SignLens server:', err);
  process.exit(1);
});
