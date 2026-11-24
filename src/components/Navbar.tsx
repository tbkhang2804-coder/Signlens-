import React, { useState } from 'react';
import { BookOpen, Cpu, FileText, Home, Menu, MessageSquare, Moon, Sun, User, Video, X } from 'lucide-react';
import type { AdminUser, AppRoute, ThemeMode } from '../types/signlens';
import { SignLensBrandLogo } from './Icons';

interface NavbarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  adminUser: AdminUser | null;
  onOpenAccount: () => void;
}

const NAV_ITEMS: Array<{
  route: AppRoute;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { route: 'home', label: 'Trang chủ', Icon: Home },
  { route: 'call', label: 'Gọi Video', Icon: Video },
  { route: 'learn', label: 'Học VSL', Icon: BookOpen },
  { route: 'docs', label: 'Giao tiếp nhanh', Icon: MessageSquare },
  { route: 'studio', label: 'Studio AI', Icon: Cpu },
];

export default function Navbar({
  currentRoute,
  onNavigate,
  theme,
  onToggleTheme,
  adminUser,
  onOpenAccount,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (route: AppRoute) => {
    onNavigate(route);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 glass-nav">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 h-14 sm:h-[72px] flex items-center justify-between gap-4 sm:gap-8">
        {/* Brand Zone */}
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer shrink-0 min-h-[40px]"
        >
          <SignLensBrandLogo className="w-9 h-9 sm:w-10 sm:h-10 group-hover:scale-105 transition-transform" />
          <span className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            SignLens{' '}
            <span className="bg-gradient-to-r from-sky-500 to-emerald-500 dark:from-sky-400 dark:to-emerald-400 bg-clip-text text-transparent">
              AI
            </span>
          </span>
        </button>

        {/* Desktop Navigation Links */}
        <nav
          className="hidden lg:flex items-center gap-1.5"
          aria-label="Điều hướng chính"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = currentRoute === item.route;
            const ItemIcon = item.Icon;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleNavClick(item.route)}
                className={`px-3.5 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'font-bold text-slate-900 dark:text-white bg-slate-200/70 dark:bg-slate-800'
                    : 'font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                <ItemIcon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Header Actions: Theme Switch + Account + Mobile Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
            className="w-10 h-10 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenAccount}
            className="min-h-[40px] sm:min-h-0 px-3 sm:px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-emerald-500 hover:opacity-90 text-white dark:text-slate-950 text-xs font-extrabold transition-all inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{adminUser ? adminUser.username : 'Tài khoản'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
            className="lg:hidden w-10 h-10 inline-flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <nav
          className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 px-4 py-3 space-y-1.5"
          aria-label="Điều hướng di động"
        >
          {NAV_ITEMS.map((item) => {
            const ItemIcon = item.Icon;
            const isActive = currentRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleNavClick(item.route)}
                className={`w-full min-h-[44px] text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer ${
                  isActive
                    ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                <ItemIcon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
