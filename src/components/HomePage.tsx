import React from 'react';
import {
  ArrowRight,
  BookOpen,
  FileText,
  Hand,
  Laptop,
  Smartphone,
} from 'lucide-react';
import type { AppRoute } from '../types/signlens';
import { CamOnSvg, MicOnSvg, SignLensBrandLogo, SpeakerSvg } from './Icons';

interface HomePageProps {
  onNavigate: (route: AppRoute) => void;
}

const FEATURE_CARDS: Array<{
  route: AppRoute;
  title: string;
  description: string;
  ctaLabel: string;
  accentClass: string;
  iconBgClass: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    route: 'call',
    title: 'Gọi video hai thiết bị',
    description:
      'Tạo mã phòng hoặc quét QR để kết nối laptop và điện thoại qua WebRTC kèm phụ đề trực tiếp.',
    ctaLabel: 'Kết nối cuộc gọi',
    accentClass: 'hover:border-emerald-400/70',
    iconBgClass: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    Icon: CamOnSvg,
  },
  {
    route: 'studio',
    title: 'Nhận diện ngôn ngữ ký hiệu VSL',
    description:
      'Theo dõi 21 khớp bàn tay qua camera ngay trên trình duyệt, nhận diện ký hiệu và huấn luyện mẫu riêng.',
    ctaLabel: 'Mở phòng thí nghiệm AI',
    accentClass: 'hover:border-sky-400/70',
    iconBgClass: 'bg-sky-500/12 text-sky-600 dark:text-sky-400 border-sky-500/25',
    Icon: Hand,
  },
  {
    route: 'docs',
    title: 'Phụ đề và giao tiếp văn bản',
    description:
      'Chuyển giọng nói thành phụ đề thời gian thực, nhắn tin hai chiều và tạo file phụ đề .SRT nhanh.',
    ctaLabel: 'Mở công cụ phụ đề',
    accentClass: 'hover:border-indigo-400/70',
    iconBgClass: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
    Icon: FileText,
  },
  {
    route: 'learn',
    title: 'Học ngôn ngữ ký hiệu',
    description:
      'Thực hành ngôn ngữ ký hiệu Việt Nam qua mô phỏng bàn tay 2D từng nhịp, bảng chữ cái và video YouTube.',
    ctaLabel: 'Vào bài học VSL',
    accentClass: 'hover:border-teal-400/70',
    iconBgClass: 'bg-teal-500/12 text-teal-600 dark:text-teal-400 border-teal-500/25',
    Icon: BookOpen,
  },
];

export default function HomePage({ onNavigate }: HomePageProps) {
  const scrollToExplore = () => {
    const el = document.getElementById('signlens-explore');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex flex-col">
      {/* Compact Above-the-Fold Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-7 sm:pt-10 sm:pb-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          {/* Left Copy & Primary CTAs */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-5 text-center lg:text-left">
            <p className="text-xs sm:text-sm font-bold tracking-wide text-sky-600 dark:text-sky-400">
              Kết nối bằng ngôn ngữ ký hiệu
            </p>

            <h1 className="text-[28px] sm:text-5xl lg:text-[52px] font-black text-slate-900 dark:text-white leading-[1.12] tracking-tight text-balance">
              PHÁ BỎ RÀO CẢN{' '}
              <span className="bg-gradient-to-r from-sky-500 to-emerald-500 dark:from-sky-400 dark:to-emerald-400 bg-clip-text text-transparent">
                GIAO TIẾP
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
              SignLens hỗ trợ kết nối người khiếm thính và người nghe qua cuộc gọi video, nhận diện VSL và phụ đề.
            </p>

            {/* Exactly 2 Hero Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('call')}
                className="min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-extrabold shadow-lg shadow-emerald-500/25 inline-flex items-center justify-center gap-2.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <CamOnSvg className="w-4 h-4" />
                <span>Bắt đầu gọi video</span>
              </button>

              <button
                type="button"
                onClick={scrollToExplore}
                className="min-h-[48px] px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Khám phá SignLens</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Minimal Two-Device Architecture Card */}
          <div className="lg:col-span-5">
            <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Cuộc gọi video hai thiết bị
                </span>
                <span>WebRTC · VSL · Phụ đề</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3.5 text-white space-y-2">
                  <div className="flex items-center justify-between text-sky-400">
                    <Smartphone className="w-4 h-4" />
                    <Hand className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold">Thiết bị người ký hiệu</div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Camera nhận diện VSL sang văn bản tiếng Việt.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3.5 text-white space-y-2">
                  <div className="flex items-center justify-between text-emerald-400">
                    <Laptop className="w-4 h-4" />
                    <MicOnSvg className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold">Thiết bị người nghe</div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Hiển thị phụ đề, phát giọng nói và phản hồi tức thì.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-100/90 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Phụ đề đồng bộ trực tiếp
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    Xin chào, rất vui được kết nối với bạn.
                  </div>
                </div>
                <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <SpeakerSvg className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Core Feature Cards */}
      <section
        id="signlens-explore"
        className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 border-t border-slate-200 dark:border-slate-800/80 w-full space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Tính năng cốt lõi của SignLens
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              Tập trung vào cuộc gọi video hai thiết bị, nhận diện VSL, phụ đề và học ngôn ngữ ký hiệu.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {FEATURE_CARDS.map((card) => {
            const CardIcon = card.Icon;
            return (
              <button
                key={card.title}
                type="button"
                onClick={() => onNavigate(card.route)}
                className={`text-left glass-card rounded-2xl p-5 transition-all group flex flex-col justify-between gap-5 cursor-pointer ${card.accentClass}`}
              >
                <div className="space-y-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center ${card.iconBgClass}`}
                  >
                    <CardIcon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  <span>{card.ctaLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Quiet SaaS Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/75 dark:bg-slate-950/85 mt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 sm:py-9">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-6 border-b border-slate-200 dark:border-slate-800/80">
            <div className="col-span-2 space-y-2.5">
              <div className="flex items-center gap-3">
                <SignLensBrandLogo className="w-10 h-10" />
                <div>
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    SignLens <span className="text-emerald-500 dark:text-emerald-400">AI</span>
                  </span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Phá bỏ rào cản giao tiếp · Kết nối bằng ngôn ngữ ký hiệu
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
                Nền tảng hỗ trợ giao tiếp giữa người khiếm thính và người nghe qua cuộc gọi video hai thiết bị, nhận diện VSL, phụ đề và học ngôn ngữ ký hiệu.
              </p>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Giao tiếp &amp; Cuộc gọi
              </h4>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('call')}
                    className="hover:text-emerald-500 transition-colors cursor-pointer"
                  >
                    Kết nối cuộc gọi video
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('docs')}
                    className="hover:text-indigo-500 transition-colors cursor-pointer"
                  >
                    Phụ đề &amp; Văn bản .SRT
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Học tập &amp; Huấn luyện
              </h4>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('learn')}
                    className="hover:text-teal-500 transition-colors cursor-pointer"
                  >
                    Học ngôn ngữ ký hiệu VSL
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('studio')}
                    className="hover:text-sky-500 transition-colors cursor-pointer"
                  >
                    Phòng thí nghiệm AI VSL
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <p>© 2026 SignLens AI Vietnam</p>
            <p>Hỗ trợ ngôn ngữ ký hiệu Việt Nam (VSL)</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
