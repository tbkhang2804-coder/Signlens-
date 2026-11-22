import React, { useCallback, useEffect, useState } from 'react';
import type { AdminUser, AppRoute, ThemeMode, ToastNotice } from './types/signlens';
import Navbar from './components/Navbar';
import HomePage from './components/HomePage';
import ConnectPage from './components/ConnectPage';
import LearnPage from './components/LearnPage';
import DocsPage from './components/DocsPage';
import StudioPage from './components/StudioPage';
import SignBotWidget from './components/SignBotWidget';
import AccountAdminDrawer from './components/AccountAdminDrawer';
import ToastStack from './components/ToastStack';
import MobileBottomNav from './components/MobileBottomNav';
import { SignLensBrandLogo } from './components/Icons';

const THEME_STORAGE_KEY = 'signlens_theme';

function readInitialInviteRoom(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').trim();
  } catch {
    return '';
  }
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || 'Lỗi hiển thị giao diện.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-slate-100 p-6">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-800 p-6 text-center space-y-4">
            <h1 className="text-lg font-extrabold text-white">Không thể tải giao diện SignLens</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Trình duyệt trên thiết bị gặp sự cố khi khởi chạy trang. Hãy thử tải lại trang hoặc mở liên kết bằng Chrome / Safari.
            </p>
            {this.state.errorMsg && (
              <p className="text-[11px] text-rose-300 font-mono-code break-words bg-rose-500/10 rounded-xl p-2.5">
                {this.state.errorMsg}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-extrabold cursor-pointer"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <SignLensRootApp />
    </AppErrorBoundary>
  );
}

function SignLensRootApp() {
  const [inviteRoomParam, setInviteRoomParam] = useState<string>(() => readInitialInviteRoom());
  const [route, setRoute] = useState<AppRoute>(() =>
    readInitialInviteRoom() ? 'call' : 'home'
  );
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore storage errors
    }
    return 'dark';
  });

  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [studioTrainedCount, setStudioTrainedCount] = useState(0);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const pushToast = useCallback(
    (type: ToastNotice['type'], message: string) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleNavigate = useCallback((next: AppRoute) => {
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const consumeInviteRoom = useCallback(() => {
    setInviteRoomParam('');
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('room')) {
        url.searchParams.delete('room');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    } catch {
      // ignore history API errors
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col signlens-canvas grid-bg text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Navbar
        currentRoute={route}
        onNavigate={handleNavigate}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        adminUser={adminUser}
        onOpenAccount={() => setAccountOpen(true)}
      />

      <main className="flex-1 pb-[calc(74px+env(safe-area-inset-bottom))] lg:pb-0">
        {route === 'home' && <HomePage onNavigate={handleNavigate} />}
        {route === 'call' && (
          <ConnectPage
            initialInviteRoom={inviteRoomParam}
            onConsumeInviteRoom={consumeInviteRoom}
            onToast={pushToast}
            studioTrainedCount={studioTrainedCount}
          />
        )}
        {route === 'learn' && <LearnPage theme={theme} onToast={pushToast} />}
        {route === 'docs' && <DocsPage onToast={pushToast} />}
        {route === 'studio' && (
          <StudioPage
            onStudioTrained={(count) => setStudioTrainedCount(count)}
            onOpenAccountAdmin={() => setAccountOpen(true)}
            onToast={pushToast}
          />
        )}
      </main>

      {/* Bottom-left Subtle Official Brand Badge */}
      <button
        type="button"
        onClick={() => handleNavigate('home')}
        title="Logo chính thức SignLens AI — Về Trang Chủ"
        className="fixed bottom-4 left-4 z-30 hidden xl:flex items-center gap-2.5 glass-card px-3 py-2 rounded-2xl border-sky-400/40 shadow-2xl hover:border-emerald-400 transition-all group cursor-pointer text-left"
      >
        <SignLensBrandLogo className="w-10 h-10 group-hover:scale-105 transition-transform" />
        <div className="pr-1">
          <div className="text-xs font-black text-slate-900 dark:text-white tracking-tight">
            SignLens <span className="text-emerald-600 dark:text-emerald-400">AI</span>
          </div>
          <div className="text-[10px] font-semibold text-sky-700 dark:text-sky-300">
            Phá bỏ rào cản giao tiếp
          </div>
        </div>
      </button>

      {/* Global Floating SignLens Assistant Chatbot (Gemini AI + Local Fallback) */}
      <SignBotWidget />

      {/* Right-Corner Account & Admin Management Drawer */}
      <AccountAdminDrawer
        isOpen={accountOpen}
        onClose={() => setAccountOpen(false)}
        adminUser={adminUser}
        adminToken={adminToken}
        onAuthChange={(user, token) => {
          setAdminUser(user);
          setAdminToken(token);
        }}
        onStudioTrained={(count) => setStudioTrainedCount(count)}
        onToast={pushToast}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <MobileBottomNav
        currentRoute={route}
        onNavigate={handleNavigate}
        onOpenAccount={() => setAccountOpen(true)}
      />
    </div>
  );
}
