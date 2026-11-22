import React, { useState } from 'react';
import { BookOpen, Cpu, FileText, Home, MoreHorizontal, Shield, Video, X } from 'lucide-react';
import type { AppRoute } from '../types/signlens';

interface MobileBottomNavProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onOpenAccount: () => void;
}

export default function MobileBottomNav({
  currentRoute,
  onNavigate,
  onOpenAccount,
}: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = currentRoute === 'docs' || currentRoute === 'studio';

  const handleSelect = (route: AppRoute) => {
    setMoreOpen(false);
    onNavigate(route);
  };

  return (
    <>
      {/* Mobile Bottom Sheet for Additional Tools */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2" />
            <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-sm font-black text-slate-900 dark:text-white">
                Công cụ &amp; Quản trị SignLens
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Đóng bảng công cụ"
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleSelect('docs')}
              className={`w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center gap-3 text-left transition-colors cursor-pointer ${
                currentRoute === 'docs'
                  ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold">Dịch Văn Bản &amp; Phụ Đề .SRT</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Tóm tắt giấy tờ, đơn thuốc sang VSL &amp; xuất .SRT
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelect('studio')}
              className={`w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl flex items-center gap-3 text-left transition-colors cursor-pointer ${
                currentRoute === 'studio'
                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold">Phòng Thí Nghiệm AI &amp; Telemetry</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Đo khớp 5 ngón tay, ghi mẫu &amp; huấn luyện k-NN
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onOpenAccount();
              }}
              className="w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-left text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold">Tài Khoản &amp; Quản Trị Studio</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Đăng nhập Admin và đồng bộ dữ liệu ký hiệu
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Fixed Compact Thumb-Zone Bottom Tab Bar (Preserved Design, 4 Approved Tabs + Safe Area) */}
      <nav
        aria-label="Thanh điều hướng nhanh di động"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-nav border-t border-slate-200 dark:border-slate-800/90 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-4 h-[58px] items-center px-1">
          <button
            type="button"
            onClick={() => handleSelect('home')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              currentRoute === 'home'
                ? 'text-sky-600 dark:text-sky-400 font-extrabold'
                : 'text-slate-500 dark:text-slate-400 font-medium'
            }`}
          >
            <Home className="w-[18px] h-[18px]" />
            <span className="text-[10px] tracking-tight whitespace-nowrap">Trang chủ</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelect('call')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              currentRoute === 'call'
                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                : 'text-slate-500 dark:text-slate-400 font-medium'
            }`}
          >
            <Video className="w-[18px] h-[18px]" />
            <span className="text-[10px] tracking-tight whitespace-nowrap">Gọi Video</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelect('learn')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              currentRoute === 'learn'
                ? 'text-teal-600 dark:text-teal-400 font-extrabold'
                : 'text-slate-500 dark:text-slate-400 font-medium'
            }`}
          >
            <BookOpen className="w-[18px] h-[18px]" />
            <span className="text-[10px] tracking-tight whitespace-nowrap">Học VSL</span>
          </button>

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              isMoreActive || moreOpen
                ? 'text-indigo-600 dark:text-indigo-400 font-extrabold'
                : 'text-slate-500 dark:text-slate-400 font-medium'
            }`}
          >
            <MoreHorizontal className="w-[18px] h-[18px]" />
            <span className="text-[10px] tracking-tight whitespace-nowrap">Công cụ</span>
          </button>
        </div>
      </nav>
    </>
  );
}
