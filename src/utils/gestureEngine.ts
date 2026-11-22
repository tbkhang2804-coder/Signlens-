import type { LandmarkPoint, StudioSampleRecord } from '../types/signlens';

export const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export interface RecognitionPrediction {
  sign: string;
  source: string;
  confidence: number;
  label: string;
}

export const VSL_LABEL_MEANINGS: Record<string, string> = {
  XIN_CHAO: 'Xin chào',
  CAM_ON: 'Cảm ơn',
  TAM_BIET: 'Tạm biệt',
  GIUP_TOI: 'Cần giúp đỡ',
  TOI: 'Tôi',
  BAN: 'Bạn',
  CO: 'Có / Đồng ý',
  KHONG: 'Không',
  Y_TE: 'Cần hỗ trợ y tế',
  YEU_THUONG: 'Tôi yêu bạn',
  DONG_Y: 'Đồng ý',
  XIN_LOI: 'Xin lỗi',
  KHOE_KHONG: 'Bạn khỏe không?',
  HIEU_ROI: 'Tôi hiểu rồi',
  CHAM_LAI: 'Xin nói chậm lại',
};

export class DemoWaveDetector {
  private lastExtremeX = -1;
  private direction = 0;
  private waveCount = 0;
  private lastUpdateTime = 0;
  private cooldownUntil = 0;
  private readonly threshold = 0.04;

  update(wristX: number, now: number): RecognitionPrediction | null {
    if (now < this.cooldownUntil) return null;
    if (now - this.lastUpdateTime > 500) {
      this.lastExtremeX = wristX;
      this.direction = 0;
      this.waveCount = 0;
    }
    this.lastUpdateTime = now;

    const diff = wristX - this.lastExtremeX;
    if (this.direction === 0) {
      if (Math.abs(diff) > this.threshold) {
        this.direction = diff > 0 ? 1 : -1;
        this.lastExtremeX = wristX;
        this.waveCount = 1;
      }
    } else if (this.direction === 1) {
      if (diff < -this.threshold) {
        this.direction = -1;
        this.lastExtremeX = wristX;
        this.waveCount++;
      } else if (wristX > this.lastExtremeX) {
        this.lastExtremeX = wristX;
      }
    } else if (this.direction === -1) {
      if (diff > this.threshold) {
        this.direction = 1;
        this.lastExtremeX = wristX;
        this.waveCount++;
      } else if (wristX < this.lastExtremeX) {
        this.lastExtremeX = wristX;
      }
    }

    if (this.waveCount >= 3) {
      this.cooldownUntil = now + 2400;
      this.waveCount = 0;
      return {
        label: 'XIN_CHAO',
        sign: 'Xin chào',
        source: 'Quy tắc cử chỉ — Vẫy tay',
        confidence: 0.95,
      };
    }

    return null;
  }
}

export interface TrainedTemplate {
  label: string;
  signText: string;
  vector: number[];
  lang: string;
  source?: 'custom' | 'builtin';
}

interface CandidateVote {
  label: string;
  signText: string;
  dist: number;
  timestamp: number;
}

function createSyntheticLandmarks(options: {
  thumb: number; // 0 = curled, 1 = extended
  index: number;
  middle: number;
  ring: number;
  pinky: number;
  thumbPose?: 'up' | 'spread' | 'flat';
  spread?: number;
}): LandmarkPoint[] {
  const pts: LandmarkPoint[] = new Array(21);
  // Wrist
  pts[0] = { x: 0.5, y: 0.8, z: 0 };
  const mcpX = [0.42, 0.49, 0.55, 0.61];
  const mcpY = [0.55, 0.52, 0.54, 0.57];

  // Thumb
  pts[1] = { x: 0.44, y: 0.72, z: -0.02 };
  pts[2] = { x: 0.38, y: 0.65, z: -0.04 };
  if (options.thumb >= 0.8) {
    if (options.thumbPose === 'up') {
      pts[3] = { x: 0.34, y: 0.52, z: -0.04 };
      pts[4] = { x: 0.30, y: 0.40, z: -0.04 }; // Thumb pointed high up
    } else {
      pts[3] = { x: 0.32, y: 0.60, z: -0.03 };
      pts[4] = { x: 0.25, y: 0.55, z: -0.02 }; // Thumb spread outward
    }
  } else {
    // Thumb curled across palm
    pts[3] = { x: 0.44, y: 0.62, z: 0.02 };
    pts[4] = { x: 0.48, y: 0.64, z: 0.04 };
  }

  // Fingers: Index (5-8), Middle (9-12), Ring (13-16), Pinky (17-20)
  const fingerStates = [options.index, options.middle, options.ring, options.pinky];
  const spreadX = options.spread ?? 0.02;

  fingerStates.forEach((state, fIdx) => {
    const baseIdx = 5 + fIdx * 4;
    const baseX = mcpX[fIdx] + (fIdx - 1.5) * spreadX;
    const baseY = mcpY[fIdx];
    pts[baseIdx] = { x: baseX, y: baseY, z: 0 };

    if (state >= 0.8) {
      // Extended upward
      pts[baseIdx + 1] = { x: baseX, y: baseY - 0.12, z: -0.01 };
      pts[baseIdx + 2] = { x: baseX, y: baseY - 0.22, z: -0.02 };
      pts[baseIdx + 3] = { x: baseX, y: baseY - 0.32, z: -0.02 };
    } else {
      // Curled into palm
      pts[baseIdx + 1] = { x: baseX, y: baseY + 0.06, z: 0.04 };
      pts[baseIdx + 2] = { x: baseX, y: baseY + 0.12, z: 0.06 };
      pts[baseIdx + 3] = { x: baseX, y: baseY + 0.14, z: 0.04 };
    }
  });

  return pts;
}

const STORAGE_KEY_TEMPLATES = 'signlens_trained_templates';

class StudioModelTrainerClass {
  isTrained = false;
  templates: TrainedTemplate[] = [];

  // Multi-frame voting and anti-flutter debouncing
  private recentVotes: CandidateVote[] = [];
  private lastEmittedLabel = '';
  private lastEmittedTime = 0;

  constructor() {
    this.initDefaultTemplates();
    this.loadFromStorage();
  }

  extractFeatures(handLandmarks: LandmarkPoint[]): number[] {
    const wrist = handLandmarks[0];
    const scale =
      Math.hypot(
        handLandmarks[9].x - wrist.x,
        handLandmarks[9].y - wrist.y,
        (handLandmarks[9].z || 0) - (wrist.z || 0)
      ) || 0.1;

    const vec: number[] = [];

    // 1. Normalized Relative Landmark Coordinates (63 values)
    for (let i = 0; i < 21; i++) {
      vec.push(
        (handLandmarks[i].x - wrist.x) / scale,
        (handLandmarks[i].y - wrist.y) / scale,
        ((handLandmarks[i].z || 0) - (wrist.z || 0)) / scale
      );
    }

    // 2. Normalized Fingertip-to-Wrist Distances (5 values)
    const tipIndices = [4, 8, 12, 16, 20];
    for (const tip of tipIndices) {
      vec.push(
        Math.hypot(
          handLandmarks[tip].x - wrist.x,
          handLandmarks[tip].y - wrist.y,
          (handLandmarks[tip].z || 0) - (wrist.z || 0)
        ) / scale
      );
    }

    // 3. Finger Curl Ratios (5 values: Tip-to-Wrist / MCP-to-Wrist)
    const mcpDist = (mcp: number) =>
      Math.hypot(handLandmarks[mcp].x - wrist.x, handLandmarks[mcp].y - wrist.y) || 0.05;
    const tipDist = (tip: number) =>
      Math.hypot(handLandmarks[tip].x - wrist.x, handLandmarks[tip].y - wrist.y);

    vec.push(
      Math.hypot(handLandmarks[4].x - handLandmarks[2].x, handLandmarks[4].y - handLandmarks[2].y) / scale,
      tipDist(8) / mcpDist(5),
      tipDist(12) / mcpDist(9),
      tipDist(16) / mcpDist(13),
      tipDist(20) / mcpDist(17)
    );

    // 4. Pairwise Fingertip Spread (8 values)
    const pairs = [
      [4, 8], [8, 12], [12, 16], [16, 20],
      [4, 20], [8, 20], [4, 12], [4, 17]
    ];
    for (const [p1, p2] of pairs) {
      vec.push(
        Math.hypot(
          handLandmarks[p1].x - handLandmarks[p2].x,
          handLandmarks[p1].y - handLandmarks[p2].y,
          (handLandmarks[p1].z || 0) - (handLandmarks[p2].z || 0)
        ) / scale
      );
    }

    return vec;
  }

  private initDefaultTemplates(): void {
    const builtinDefs: Array<{
      label: string;
      signText: string;
      opts: Parameters<typeof createSyntheticLandmarks>[0];
    }> = [
      {
        label: 'XIN_CHAO',
        signText: 'Xin chào',
        opts: { thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1, spread: 0.035 },
      },
      {
        label: 'CAM_ON',
        signText: 'Cảm ơn',
        opts: { thumb: 0.5, index: 1, middle: 1, ring: 1, pinky: 1, spread: 0.005 },
      },
      {
        label: 'TAM_BIET',
        signText: 'Tạm biệt',
        opts: { thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1, spread: 0.04 },
      },
      {
        label: 'CO',
        signText: 'Có / Đồng ý',
        opts: { thumb: 1, index: 0, middle: 0, ring: 0, pinky: 0, thumbPose: 'up' },
      },
      {
        label: 'KHONG',
        signText: 'Không',
        opts: { thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, spread: 0.01 },
      },
      {
        label: 'YEU_THUONG',
        signText: 'Tôi yêu bạn',
        opts: { thumb: 1, index: 1, middle: 0, ring: 0, pinky: 1, spread: 0.03 },
      },
      {
        label: 'Y_TE',
        signText: 'Cần hỗ trợ y tế',
        opts: { thumb: 0, index: 1, middle: 1, ring: 0, pinky: 0, spread: 0.03 },
      },
      {
        label: 'GIUP_TOI',
        signText: 'Cần giúp đỡ',
        opts: { thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1, spread: 0.02 },
      },
      {
        label: 'TOI',
        signText: 'Tôi',
        opts: { thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, spread: 0.01 },
      },
      {
        label: 'BAN',
        signText: 'Bạn',
        opts: { thumb: 0, index: 1, middle: 0, ring: 0, pinky: 0, spread: 0.02 },
      },
    ];

    this.templates = builtinDefs.map((def) => {
      const synthetic = createSyntheticLandmarks(def.opts);
      return {
        label: def.label,
        signText: def.signText,
        vector: this.extractFeatures(synthetic),
        lang: 'VSL',
        source: 'builtin',
      };
    });

    this.isTrained = this.templates.length > 0;
  }

  loadFromStorage(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge custom templates on top of built-in templates
          const custom = parsed.filter(
            (t): t is TrainedTemplate =>
              t && typeof t.label === 'string' && Array.isArray(t.vector) && t.vector.length > 0
          );
          if (custom.length > 0) {
            const customLabels = new Set(custom.map((c) => c.label));
            const remainingBuiltins = this.templates.filter((b) => !customLabels.has(b.label));
            this.templates = [...custom, ...remainingBuiltins];
            this.isTrained = true;
            return true;
          }
        }
      }
    } catch {
      // ignore storage errors
    }
    return false;
  }

  saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(this.templates));
    } catch {
      // ignore storage errors
    }
  }

  trainFromSamples(samples: StudioSampleRecord[]): boolean {
    if (!samples || samples.length === 0) {
      this.initDefaultTemplates();
      return true;
    }

    const byLabel = new Map<string, Array<{ vec: number[]; lang: string }>>();

    for (const sample of samples) {
      if (!sample.sequence || sample.sequence.length === 0) continue;
      const validFrames = sample.sequence
        .map((frame) => {
          if (!frame.hands || !frame.hands[0] || frame.hands[0].length < 21) return null;
          return this.extractFeatures(frame.hands[0]);
        })
        .filter((x): x is number[] => x !== null);

      if (validFrames.length > 0) {
        const dim = validFrames[0].length;
        const meanVec = new Array<number>(dim).fill(0);
        for (const v of validFrames) {
          for (let i = 0; i < dim; i++) meanVec[i] += v[i];
        }
        for (let i = 0; i < dim; i++) meanVec[i] /= validFrames.length;

        const lang = sample.signLang || 'VSL';
        const list = byLabel.get(sample.label) || [];
        list.push({ vec: meanVec, lang });
        byLabel.set(sample.label, list);
      }
    }

    const customTemplates: TrainedTemplate[] = [];

    for (const [label, records] of byLabel.entries()) {
      if (records.length === 0) continue;
      const dim = records[0].vec.length;
      const finalVec = new Array<number>(dim).fill(0);
      for (const r of records) {
        for (let i = 0; i < dim; i++) finalVec[i] += r.vec[i];
      }
      for (let i = 0; i < dim; i++) finalVec[i] /= records.length;

      const signText = VSL_LABEL_MEANINGS[label] || label.replace(/_/g, ' ');
      customTemplates.push({
        label,
        signText,
        vector: finalVec,
        lang: records[0].lang,
        source: 'custom',
      });
    }

    // Merge: custom templates take precedence, remaining built-ins act as fallback
    const customLabels = new Set(customTemplates.map((c) => c.label));
    const builtins = this.templates.filter((b) => b.source === 'builtin' && !customLabels.has(b.label));

    this.templates = [...customTemplates, ...builtins];
    this.isTrained = this.templates.length > 0;
    this.saveToStorage();
    return this.isTrained;
  }

  predict(liveHands: LandmarkPoint[][], now: number, activeLang = 'VSL'): RecognitionPrediction | null {
    if (!this.isTrained || this.templates.length === 0 || !liveHands[0] || liveHands[0].length < 21) {
      this.recentVotes = [];
      return null;
    }

    // Strict language matching to prevent cross-language confusion
    const activeTemplates = this.templates.filter(
      (t) => !t.lang || t.lang === activeLang || t.lang === 'ALL'
    );
    if (activeTemplates.length === 0) return null;

    const liveVec = this.extractFeatures(liveHands[0]);
    let bestDist = Infinity;
    let secondBestDist = Infinity;
    let bestTemplate: TrainedTemplate | null = null;

    for (const t of activeTemplates) {
      let distSq = 0;
      for (let i = 0; i < liveVec.length; i++) {
        const diff = liveVec[i] - t.vector[i];
        // Weighted emphasis on finger extension and curl states
        const weight = i >= 63 ? 1.75 : 1.0;
        distSq += diff * diff * weight;
      }
      const dist = Math.sqrt(distSq / liveVec.length);
      if (dist < bestDist) {
        secondBestDist = bestDist;
        bestDist = dist;
        bestTemplate = t;
      } else if (dist < secondBestDist) {
        secondBestDist = dist;
      }
    }

    // Match threshold for normalized geometric distance
    const MATCH_THRESHOLD = 0.58;
    const MARGIN_THRESHOLD = 0.06;

    const isValidCandidate =
      bestTemplate &&
      bestDist <= MATCH_THRESHOLD &&
      (secondBestDist - bestDist >= MARGIN_THRESHOLD || bestDist < 0.35);

    if (isValidCandidate && bestTemplate) {
      this.recentVotes.push({
        label: bestTemplate.label,
        signText: bestTemplate.signText,
        dist: bestDist,
        timestamp: now,
      });
    }

    // Prune stale votes older than 500ms (sliding window)
    this.recentVotes = this.recentVotes.filter((v) => now - v.timestamp < 500).slice(-8);

    // Multi-frame voting confirmation: requires at least 4 consistent votes
    if (this.recentVotes.length >= 4) {
      const counts = new Map<string, { count: number; signText: string; totalDist: number }>();
      for (const v of this.recentVotes) {
        const entry = counts.get(v.label) || { count: 0, signText: v.signText, totalDist: 0 };
        entry.count += 1;
        entry.totalDist += v.dist;
        counts.set(v.label, entry);
      }

      let topLabel = '';
      let topCount = 0;
      let topSignText = '';
      let avgDist = 0;

      for (const [lbl, data] of counts.entries()) {
        if (data.count > topCount) {
          topCount = data.count;
          topLabel = lbl;
          topSignText = data.signText;
          avgDist = data.totalDist / data.count;
        }
      }

      // Require at least 4 out of recent frames agreeing on the same sign
      if (topCount >= 4 && avgDist <= MATCH_THRESHOLD) {
        const isSameSign = topLabel === this.lastEmittedLabel;
        const cooldownMs = isSameSign ? 2400 : 850;

        if (now - this.lastEmittedTime >= cooldownMs) {
          this.lastEmittedLabel = topLabel;
          this.lastEmittedTime = now;
          this.recentVotes = []; // Clear votes after clean emission

          const conf = Math.max(0.75, Math.min(0.99, 1.0 - (avgDist / MATCH_THRESHOLD) * 0.3));
          return {
            label: topLabel,
            sign: topSignText || topLabel.replace(/_/g, ' '),
            source: `VSL AI (${activeLang})`,
            confidence: conf,
          };
        }
      }
    }

    return null;
  }

  resetHistory(): void {
    this.recentVotes = [];
    this.lastEmittedLabel = '';
    this.lastEmittedTime = 0;
  }
}

export const StudioModelTrainer = new StudioModelTrainerClass();

function connectionColor(a: number, b: number): string {
  const maxIdx = Math.max(a, b);
  if (maxIdx <= 4) return '#f59e0b';
  if (maxIdx <= 8) return '#38bdf8';
  if (maxIdx <= 12) return '#10b981';
  if (maxIdx <= 16) return '#818cf8';
  return '#f472b6';
}

function landmarkColor(idx: number): string {
  if (idx === 0) return '#f8fafc';
  if (idx <= 4) return '#f59e0b';
  if (idx <= 8) return '#38bdf8';
  if (idx <= 12) return '#10b981';
  if (idx <= 16) return '#818cf8';
  return '#f472b6';
}

export function drawHandSkeleton(ctx: CanvasRenderingContext2D, landmarks: LandmarkPoint[]): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (!w || !h || landmarks.length < 21) return;

  ctx.lineWidth = 3;
  for (const [a, b] of HAND_CONNECTIONS) {
    const pA = landmarks[a];
    const pB = landmarks[b];
    ctx.beginPath();
    ctx.moveTo(pA.x * w, pA.y * h);
    ctx.lineTo(pB.x * w, pB.y * h);
    ctx.strokeStyle = connectionColor(a, b);
    ctx.stroke();
  }

  for (let i = 0; i < landmarks.length; i++) {
    const x = landmarks[i].x * w;
    const y = landmarks[i].y * h;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = landmarkColor(i);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}

export function speakVietnameseText(text: string): { ok: boolean; reason?: string } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { ok: false, reason: 'Trình duyệt không hỗ trợ đọc giọng nói (SpeechSynthesis).' };
  }
  const clean = text.trim();
  if (!clean) return { ok: false, reason: 'Không có nội dung để đọc.' };

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'vi-VN';
  utterance.rate = 0.98;
  const voices = window.speechSynthesis.getVoices();
  const viVoice = voices.find((v) => v.lang.toLowerCase().startsWith('vi'));
  if (viVoice) utterance.voice = viVoice;
  window.speechSynthesis.speak(utterance);
  return { ok: true };
}