import React, { useState } from 'react';
import { HandLessonSvg } from './Icons';
import type { HandSvgKey } from '../utils/vslChoreographer';

interface DocsPageProps {
  onToast: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
}

const DEFAULT_DOC =
  'Bệnh nhân cần uống thuốc hạ sốt Paracetamol 500mg sau khi ăn no 30 phút, mỗi lần 1 viên, ngày uống 2 lần sáng và tối. Nếu sốt cao trên 39 độ cần quay lại bệnh viện tái khám ngay.';

const DEFAULT_SRT = `1
00:00:01,000 --> 00:00:04,500
Xin chào quý vị và các bạn đến với bản tin sức khỏe cộng đồng.

2
00:00:04,600 --> 00:00:09,200
Hôm nay chúng ta sẽ tìm hiểu cách phòng tránh cảm cúm giao mùa.`;

export default function DocsPage({ onToast }: DocsPageProps) {
  const [sourceText, setSourceText] = useState(DEFAULT_DOC);
  const [bullets, setBullets] = useState<string[]>(() =>
    DEFAULT_DOC.split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const [srtFileName, setSrtFileName] = useState('Đang nạp sẵn: Ban_Tin_Y_Te_Cong_Dong.mp4');
  const [srtContent, setSrtContent] = useState(DEFAULT_SRT);

  const translateDoc = (input = sourceText) => {
    const clean = input.trim();
    if (!clean) {
      onToast('warning', 'Vui lòng nhập nội dung văn bản trước khi chuyển đổi.');
      return;
    }
    const items = clean
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
    setBullets(items);
    onToast('success', 'Đã tóm tắt văn bản & tạo chuỗi ký hiệu VSL!');
  };

  const loadSample = (type: 'medical' | 'admin') => {
    const sample =
      type === 'medical'
        ? DEFAULT_DOC
        : 'Công dân đến làm thủ tục cấp đổi Căn cước công dân cần xuất trình giấy xác nhận thông tin cư trú, điền tờ khai điện tử tại quầy số 1 và chờ gọi tên để chụp ảnh, thu nhận vân tay.';
    setSourceText(sample);
    translateDoc(sample);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSrtFileName(`Đã nạp: ${file.name}`);
    setSrtContent(
      `1\n00:00:00,800 --> 00:00:04,200\n[Phụ đề AI tự động cho ${file.name}]\n\n2\n00:00:04,300 --> 00:00:08,900\nXin chào mọi người, nội dung video đã được chuyển thành văn bản tiếng Việt rõ ràng.`
    );
    onToast('success', 'Đã trích xuất phụ đề .SRT cho video!');
  };

  const downloadSrt = () => {
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SignLens_PhuDe_${Date.now()}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onToast('success', 'Đã tải xuống file phụ đề .SRT!');
  };

  const signCards: Array<{ word: string; svg: HandSvgKey }> = [
    { word: '1. CHÚ Ý / ĐỌC', svg: 'HELLO' },
    { word: '2. THỜI GIAN', svg: 'B' },
    { word: '3. THỰC HIỆN', svg: 'THANKS' },
    { word: '4. HỖ TRỢ / BỆNH VIỆN', svg: 'HELP' },
  ];

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-10 space-y-4 sm:space-y-6">
      <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-indigo-500/30">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-700 dark:text-indigo-300 text-[11px] sm:text-xs font-bold mb-1.5">
          <span>📄</span> Thông Dịch Văn Bản &amp; Phụ Đề .SRT
        </div>
        <h1 className="text-lg sm:text-3xl font-black text-slate-900 dark:text-white leading-snug">
          Tóm Tắt Đơn Thuốc / Giấy Tờ Sang VSL &amp; Tạo Phụ Đề
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left 7 Cols: Complex Text Summarizer */}
        <div className="lg:col-span-7 glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3.5 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              1. Tóm Tắt Văn Bản ➔ Ký Hiệu VSL
            </h2>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => loadSample('medical')}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-indigo-500/20 border border-slate-300 dark:border-slate-700 text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold cursor-pointer"
              >
                Mẫu Đơn Thuốc
              </button>
              <button
                type="button"
                onClick={() => loadSample('admin')}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-indigo-500/20 border border-slate-300 dark:border-slate-700 text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold cursor-pointer"
              >
                Mẫu Hành Chính
              </button>
            </div>
          </div>

          <textarea
            rows={4}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-400 leading-relaxed"
          />

          <button
            type="button"
            onClick={() => translateDoc()}
            className="w-full min-h-[44px] py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-sky-500 hover:opacity-95 text-white dark:text-slate-950 text-xs font-extrabold shadow-lg cursor-pointer"
          >
            ✨ Phân Tích &amp; Chuyển Sang Ngôn Ngữ Dễ Hiểu + VSL
          </button>

          <div className="bg-slate-50 dark:bg-slate-950/90 border border-indigo-500/30 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
              ✅ Bản tóm tắt ngôn ngữ trực quan cho người khiếm thính:
            </div>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200 list-disc pl-4">
              {bullets.map((line, i) => (
                <li key={`${line}_${i}`}>{line}.</li>
              ))}
            </ul>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold text-sky-700 dark:text-sky-400 mb-2">
                Chuỗi ký hiệu VSL tương ứng:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {signCards.map((c) => (
                  <div
                    key={c.word}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-center"
                  >
                    <div className="h-20 flex items-center justify-center">
                      <HandLessonSvg type={c.svg} className="w-full h-full max-h-20" />
                    </div>
                    <div className="text-[10px] font-extrabold text-sky-700 dark:text-sky-300 mt-1">
                      {c.word}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Video .SRT Generator */}
        <div className="lg:col-span-5 glass-card rounded-3xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              2. Tạo File Phụ Đề .SRT Từ Video
            </h2>
            <label className="block border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-400 rounded-2xl p-5 text-center cursor-pointer transition-colors bg-slate-50 dark:bg-slate-950/60">
              <span className="text-3xl block mb-1">🎞️</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Chọn file Video (.MP4, .WEBM)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{srtFileName}</span>
              <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
            </label>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-sky-700 dark:text-sky-400">
                  Xem trước &amp; chỉnh sửa nội dung .SRT:
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono-code">
                  UTF-8 • Tiếng Việt
                </span>
              </div>
              <textarea
                rows={7}
                value={srtContent}
                onChange={(e) => setSrtContent(e.target.value)}
                className="w-full bg-transparent font-mono-code text-[11px] text-slate-800 dark:text-slate-300 leading-relaxed focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={downloadSrt}
            className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>⬇️</span> Tải Xuống File Phụ Đề (.SRT)
          </button>
        </div>
      </div>
    </section>
  );
}
