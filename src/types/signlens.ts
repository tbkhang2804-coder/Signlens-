export type AppRoute = 'home' | 'call' | 'learn' | 'docs' | 'studio';

export type ThemeMode = 'light' | 'dark';

export type RecognitionEngineMode = 'demo' | 'model';

export type SenderRole = 'signer' | 'speaker';

export type CallRoomStatus = 'waiting' | 'active' | 'ended';

export type RtcConnectionPhase =
  | 'idle'
  | 'connecting_signal'
  | 'waiting_peer'
  | 'negotiating'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export interface CallRoomSummary {
  code: string;
  status: CallRoomStatus;
  participantCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface ConversationMessage {
  id: string;
  text: string;
  role: SenderRole;
  badgeType: 'sign' | 'voice' | 'text';
  timestamp: string;
}

export interface SignVideoLesson {
  id: string;
  name: string;
  category: string;
  lang: string;
  difficulty: string;
  videoType: 'youtube' | 'upload';
  youtubeId?: string;
  youtubeUrl?: string;
  description: string;
  fileName?: string;
  fileSize?: number;
  videoData?: string;
  createdAt: string;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface StudioFrameSample {
  timestamp: number;
  hands: LandmarkPoint[][];
}

export interface StudioSampleRecord {
  id: string;
  label: string;
  signLang: string;
  timestamp: string;
  durationMs: number;
  frameCount: number;
  sequence: StudioFrameSample[];
  schemaVersion: string;
}

export interface AdminUser {
  id: string;
  username: string;
  role: 'admin';
  fullName: string;
}

export interface AdminSignRecord {
  id: string;
  language: string;
  label: string;
  meaning_vi: string;
  category: string;
  media_url: string;
  media_type: string;
  moderation_status: 'approved' | 'pending' | 'rejected';
  created_at: string;
}

export interface ToastNotice {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}
