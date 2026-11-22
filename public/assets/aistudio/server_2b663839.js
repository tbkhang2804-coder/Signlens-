const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 5500;
const DIR = __dirname;
const DATA_DIR = path.join(DIR, 'data');
const UPLOADS_DIR = path.join(DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Server Secret Key for HMAC tokens
const SECRET_KEY = process.env.SIGNLENS_SECRET || crypto.randomBytes(32).toString('hex');

// MIME types
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

/* ── DATABASE HELPERS ───────────────────────────────── */
function readJsonFile(filename, defaultVal = []) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2), 'utf8');
      return defaultVal;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return defaultVal;
  }
}

function writeJsonFile(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  const tempPath = filePath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

/* ── AUTHENTICATION & TOKEN UTILS ───────────────────── */
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

function getAuthUser(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  return verifyToken(token);
}

/* ── HTTP HELPERS ──────────────────────────────────── */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function readBodyJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 50MB max
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/* ── SERVER LOGIC ──────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  /* ══════════════════════════════════════════════════
     API ROUTES
     ══════════════════════════════════════════════════ */

  // 1. AUTH: POST /api/auth/login
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    try {
      const { username, password } = await readBodyJson(req);
      if (!username || !password) {
        return sendJson(res, 400, { success: false, error: 'Vui lòng cung cấp đầy đủ tên đăng nhập và mật khẩu' });
      }

      const users = readJsonFile('users.json', []);
      const user = users.find(u => u.username === username);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
      }

      const hash = hashPassword(password, user.salt);
      if (hash !== user.passwordHash) {
        return sendJson(res, 401, { success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
      }

      const token = createToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName
      });

      return sendJson(res, 200, {
        success: true,
        token: token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: user.fullName
        }
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 2. AUTH: GET /api/auth/me
  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return sendJson(res, 401, { success: false, authenticated: false, error: 'Chưa xác thực hoặc phiên hết hạn' });
    }
    return sendJson(res, 200, { success: true, authenticated: true, user: authUser });
  }

  // 3. PUBLIC API: GET /api/signs (CHỈ ĐỌC, CHỈ MẪU APPROVED)
  if (req.method === 'GET' && pathname === '/api/signs') {
    const signs = readJsonFile('signs.json', []);
    const lang = parsedUrl.searchParams.get('lang');
    const category = parsedUrl.searchParams.get('category');
    const search = (parsedUrl.searchParams.get('search') || '').toLowerCase().trim();

    // Lọc chỉ những mẫu đã kiểm duyệt (approved)
    let filtered = signs.filter(s => s.moderation_status === 'approved');

    if (lang && lang !== 'all') {
      filtered = filtered.filter(s => s.language === lang);
    }
    if (category && category !== 'all') {
      filtered = filtered.filter(s => s.category === category);
    }
    if (search) {
      filtered = filtered.filter(s => 
        (s.label && s.label.toLowerCase().includes(search)) ||
        (s.meaning_vi && s.meaning_vi.toLowerCase().includes(search)) ||
        (s.meaning_original && s.meaning_original.toLowerCase().includes(search))
      );
    }

    return sendJson(res, 200, {
      success: true,
      total: filtered.length,
      data: filtered
    });
  }

  // 4. PROTECTED ADMIN APIS (/api/admin/*)
  if (pathname.startsWith('/api/admin/')) {
    const authUser = getAuthUser(req);
    if (!authUser || authUser.role !== 'admin') {
      return sendJson(res, 403, { 
        success: false, 
        error: 'Truy cập bị từ chối: Yêu cầu quyền quản trị viên Admin đã xác thực ở backend.' 
      });
    }

    // A. GET /api/admin/signs (Xem toàn bộ dữ liệu, kể cả pending & rejected)
    if (req.method === 'GET' && pathname === '/api/admin/signs') {
      const signs = readJsonFile('signs.json', []);
      const lang = parsedUrl.searchParams.get('lang');
      const status = parsedUrl.searchParams.get('status');
      const category = parsedUrl.searchParams.get('category');
      const search = (parsedUrl.searchParams.get('search') || '').toLowerCase().trim();

      let filtered = [...signs];
      if (lang && lang !== 'all') {
        filtered = filtered.filter(s => s.language === lang);
      }
      if (status && status !== 'all') {
        filtered = filtered.filter(s => s.moderation_status === status);
      }
      if (category && category !== 'all') {
        filtered = filtered.filter(s => s.category === category);
      }
      if (search) {
        filtered = filtered.filter(s => 
          (s.label && s.label.toLowerCase().includes(search)) ||
          (s.meaning_vi && s.meaning_vi.toLowerCase().includes(search)) ||
          (s.meaning_original && s.meaning_original.toLowerCase().includes(search)) ||
          (s.source && s.source.toLowerCase().includes(search))
        );
      }

      return sendJson(res, 200, {
        success: true,
        total: filtered.length,
        data: filtered
      });
    }

    // B. POST /api/admin/signs (Thêm mẫu ký hiệu mới)
    if (req.method === 'POST' && pathname === '/api/admin/signs') {
      try {
        const body = await readBodyJson(req);
        if (!body.label || !body.language || !body.meaning_vi) {
          return sendJson(res, 400, { success: false, error: 'Thiếu các trường bắt buộc (nhãn, hệ ngôn ngữ, ý nghĩa tiếng Việt)' });
        }

        const signs = readJsonFile('signs.json', []);
        const newSign = {
          id: crypto.randomUUID(),
          language: body.language || 'VSL',
          label: String(body.label).trim().toUpperCase(),
          meaning_vi: String(body.meaning_vi).trim(),
          meaning_original: body.meaning_original ? String(body.meaning_original).trim() : body.meaning_vi,
          category: body.category || 'khác',
          media_url: body.media_url || '',
          media_type: body.media_type || (body.media_url && body.media_url.includes('youtube') ? 'youtube' : 'video'),
          landmarks_sequence: Array.isArray(body.landmarks_sequence) ? body.landmarks_sequence : [],
          landmarks_count: body.landmarks_count || (Array.isArray(body.landmarks_sequence) ? body.landmarks_sequence.length : 0),
          source: body.source ? String(body.source).trim() : 'Đóng góp nội bộ',
          license: body.license || 'CC-BY-SA 4.0',
          moderation_status: body.moderation_status || 'pending',
          moderation_notes: body.moderation_notes || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        signs.unshift(newSign);
        writeJsonFile('signs.json', signs);

        return sendJson(res, 201, { success: true, message: 'Đã thêm mẫu ký hiệu thành công', data: newSign });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // C. PUT /api/admin/signs/:id (Chỉnh sửa / Kiểm duyệt mẫu ký hiệu)
    if (req.method === 'PUT' && pathname.startsWith('/api/admin/signs/')) {
      try {
        const signId = pathname.replace('/api/admin/signs/', '').trim();
        const body = await readBodyJson(req);
        const signs = readJsonFile('signs.json', []);
        const idx = signs.findIndex(s => s.id === signId);

        if (idx === -1) {
          return sendJson(res, 404, { success: false, error: 'Không tìm thấy mẫu ký hiệu với ID này' });
        }

        const existing = signs[idx];
        const updated = {
          ...existing,
          ...body,
          id: existing.id, // ID không được đổi
          updated_at: new Date().toISOString()
        };

        signs[idx] = updated;
        writeJsonFile('signs.json', signs);

        return sendJson(res, 200, { success: true, message: 'Đã cập nhật mẫu ký hiệu thành công', data: updated });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // D. DELETE /api/admin/signs/:id (Xóa mẫu ký hiệu)
    if (req.method === 'DELETE' && pathname.startsWith('/api/admin/signs/')) {
      const signId = pathname.replace('/api/admin/signs/', '').trim();
      let signs = readJsonFile('signs.json', []);
      const initialLen = signs.length;
      signs = signs.filter(s => s.id !== signId);

      if (signs.length === initialLen) {
        return sendJson(res, 404, { success: false, error: 'Không tìm thấy mẫu ký hiệu để xóa' });
      }

      writeJsonFile('signs.json', signs);
      return sendJson(res, 200, { success: true, message: 'Đã xóa mẫu ký hiệu thành công', deletedId: signId });
    }

    // E. GET /api/admin/stats (Thống kê & Quản lý mô hình 4 tầng)
    if (req.method === 'GET' && pathname === '/api/admin/stats') {
      const signs = readJsonFile('signs.json', []);
      const stats = {
        totalDatabaseRecords: signs.length,
        byLanguage: {
          VSL: signs.filter(s => s.language === 'VSL').length,
          ASL: signs.filter(s => s.language === 'ASL').length,
          BSL: signs.filter(s => s.language === 'BSL').length
        },
        byStatus: {
          approved: signs.filter(s => s.moderation_status === 'approved').length,
          pending: signs.filter(s => s.moderation_status === 'pending').length,
          rejected: signs.filter(s => s.moderation_status === 'rejected').length
        },
        trainingReadyDataset: {
          total: signs.filter(s => s.moderation_status === 'approved' && (s.landmarks_count > 0 || (s.landmarks_sequence && s.landmarks_sequence.length > 0))).length,
          vsl: signs.filter(s => s.language === 'VSL' && s.moderation_status === 'approved').length,
          asl: signs.filter(s => s.language === 'ASL' && s.moderation_status === 'approved').length,
          bsl: signs.filter(s => s.language === 'BSL' && s.moderation_status === 'approved').length
        },
        deployedModels: {
          activeEngine: 'Rule-based DemoWave + Studio k-NN Classifier',
          supportedLanguagesTrained: ['VSL (Cục bộ Studio)'],
          note: 'AI KHÔNG tự động học khi thêm video/ảnh vào DB. Cần qua bước thẩm định, chuẩn hóa landmark và chạy pipeline huấn luyện riêng.'
        }
      };
      return sendJson(res, 200, { success: true, data: stats });
    }

    // F. GET /api/admin/export/:lang (Xuất dataset huấn luyện chuẩn JSON)
    if (req.method === 'GET' && pathname.startsWith('/api/admin/export/')) {
      const lang = pathname.replace('/api/admin/export/', '').trim().toUpperCase();
      const signs = readJsonFile('signs.json', []);
      const dataset = signs.filter(s => s.language === lang && s.moderation_status === 'approved');

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="signlens_${lang.toLowerCase()}_dataset_${Date.now()}.json"`,
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(JSON.stringify({
        schema_version: '2.0',
        sign_language: lang,
        exported_at: new Date().toISOString(),
        total_samples: dataset.length,
        samples: dataset
      }, null, 2));
    }

    // G. POST /api/admin/upload (Upload video hoặc ảnh mẫu)
    if (req.method === 'POST' && pathname === '/api/admin/upload') {
      try {
        const body = await readBodyJson(req);
        if (!body.filename || !body.base64Data) {
          return sendJson(res, 400, { success: false, error: 'Thiếu dữ liệu file tải lên' });
        }

        const ext = path.extname(body.filename).toLowerCase();
        if (!['.mp4', '.webm', '.mov', '.jpg', '.jpeg', '.png'].includes(ext)) {
          return sendJson(res, 400, { success: false, error: 'Định dạng tệp không được hỗ trợ' });
        }

        const uniqueFilename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
        const targetFilePath = path.join(UPLOADS_DIR, uniqueFilename);
        const buffer = Buffer.from(body.base64Data, 'base64');

        fs.writeFileSync(targetFilePath, buffer);
        const publicUrl = `/uploads/${uniqueFilename}`;

        return sendJson(res, 200, {
          success: true,
          url: publicUrl,
          filename: uniqueFilename,
          size: buffer.length
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // H. LESSONS MANAGEMENT (GET, POST, DELETE)
    if (pathname === '/api/admin/lessons') {
      if (req.method === 'GET') {
        const lessons = readJsonFile('lessons.json', []);
        return sendJson(res, 200, { success: true, data: lessons });
      }
      if (req.method === 'POST') {
        const body = await readBodyJson(req);
        const lessons = readJsonFile('lessons.json', []);
        const newLesson = {
          id: crypto.randomUUID(),
          title: body.title || 'Bài học mới',
          category: body.category || 'khác',
          language: body.language || 'VSL',
          difficulty: body.difficulty || 'cơ_bản',
          sourceType: body.sourceType || 'youtube',
          videoUrl: body.videoUrl || '',
          description: body.description || '',
          createdAt: new Date().toISOString()
        };
        lessons.unshift(newLesson);
        writeJsonFile('lessons.json', lessons);
        return sendJson(res, 201, { success: true, data: newLesson });
      }
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/admin/lessons/')) {
      const lessonId = pathname.replace('/api/admin/lessons/', '').trim();
      let lessons = readJsonFile('lessons.json', []);
      lessons = lessons.filter(l => l.id !== lessonId);
      writeJsonFile('lessons.json', lessons);
      return sendJson(res, 200, { success: true, message: 'Đã xóa bài học' });
    }

    return sendJson(res, 404, { success: false, error: 'Endpoint admin không tồn tại' });
  }

  /* ══════════════════════════════════════════════════
     STATIC FILE SERVING
     ══════════════════════════════════════════════════ */
  let reqPath = decodeURI(pathname);
  if (reqPath === '/' || reqPath === '') reqPath = '/webcam.html';

  let filePath;
  if (reqPath.startsWith('/uploads/')) {
    filePath = path.join(DIR, reqPath);
  } else {
    filePath = path.join(DIR, reqPath);
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File Not Found: ' + reqPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(content);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SignLens Server running at http://localhost:${PORT}/webcam.html`);
  console.log(`REST APIs active with secure backend authentication.`);
});
