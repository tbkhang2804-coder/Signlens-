import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Bus,
  Check,
  Copy,
  GraduationCap,
  HeartHandshake,
  Maximize2,
  MessageSquare,
  Plus,
  Search,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
  Trash2,
  Utensils,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { speakVietnameseText } from '../utils/gestureEngine';

interface QuickCommPageProps {
  onToast: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
}

export type CommCategoryKey =
  | 'favorites'
  | 'daily'
  | 'shopping'
  | 'dining'
  | 'school'
  | 'transport'
  | 'emergency';

interface CommItem {
  id: string;
  text: string;
  category: CommCategoryKey;
  isCustom?: boolean;
}

const STORAGE_FAVORITES_KEY = 'signlens_quick_comm_favorites';
const STORAGE_CUSTOM_KEY = 'signlens_quick_comm_custom_phrases';

const DEFAULT_PRESET_ITEMS: CommItem[] = [
  // Hằng ngày
  { id: 'daily-1', text: 'Xin chào bạn! Rất vui được gặp bạn.', category: 'daily' },
  { id: 'daily-2', text: 'Cảm ơn bạn rất nhiều vì đã giúp đỡ tôi!', category: 'daily' },
  { id: 'daily-3', text: 'Xin lỗi vì sự bất tiện này.', category: 'daily' },
  { id: 'daily-4', text: 'Tạm biệt, chúc bạn một ngày tốt lành!', category: 'daily' },
  { id: 'daily-5', text: 'Tôi là người khiếm thính và sử dụng ngôn ngữ ký hiệu.', category: 'daily' },
  { id: 'daily-6', text: 'Bạn có thể nói chậm hơn một chút được không?', category: 'daily' },
  { id: 'daily-7', text: 'Tôi hiểu rồi, cảm ơn bạn rất nhiều.', category: 'daily' },
  { id: 'daily-8', text: 'Tôi chưa hiểu rõ, xin vui lòng viết ra giấy hoặc gõ vào điện thoại giúp tôi.', category: 'daily' },
  { id: 'daily-9', text: 'Bạn có khỏe không?', category: 'daily' },
  { id: 'daily-10', text: 'Hẹn gặp lại bạn lần sau nhé!', category: 'daily' },

  // Mua sắm
  { id: 'shop-1', text: 'Món đồ này giá bao nhiêu tiền vậy ạ?', category: 'shopping' },
  { id: 'shop-2', text: 'Tôi muốn mua món đồ này.', category: 'shopping' },
  { id: 'shop-3', text: 'Món này có kích cỡ lớn hơn hoặc nhỏ hơn không?', category: 'shopping' },
  { id: 'shop-4', text: 'Món này có màu khác nữa không ạ?', category: 'shopping' },
  { id: 'shop-5', text: 'Tôi có thể thanh toán bằng chuyển khoản hoặc quét mã QR không?', category: 'shopping' },
  { id: 'shop-6', text: 'Làm ơn cho tôi xin hóa đơn thanh toán nhé.', category: 'shopping' },
  { id: 'shop-7', text: 'Sản phẩm này có chính sách đổi trả hoặc bảo hành không?', category: 'shopping' },
  { id: 'shop-8', text: 'Cho tôi xem thử món hàng ở trên kệ kia được không?', category: 'shopping' },
  { id: 'shop-9', text: 'Cảm ơn bạn, tôi sẽ tham khảo và quay lại sau.', category: 'shopping' },

  // Ăn uống
  { id: 'dine-1', text: 'Tôi muốn gọi món này.', category: 'dining' },
  { id: 'dine-2', text: 'Món ăn này có cay không vậy bạn?', category: 'dining' },
  { id: 'dine-3', text: 'Làm ơn cho tôi xin một cốc nước lọc / nước ấm.', category: 'dining' },
  { id: 'dine-4', text: 'Món này xin vui lòng không bỏ đường và không bỏ đá.', category: 'dining' },
  { id: 'dine-5', text: 'Làm ơn cho tôi xin thêm khăn giấy và thìa / đũa.', category: 'dining' },
  { id: 'dine-6', text: 'Cho tôi xin tính tiền / thanh toán bữa ăn.', category: 'dining' },
  { id: 'dine-7', text: 'Nhà vệ sinh của quán ở hướng nào vậy?', category: 'dining' },
  { id: 'dine-8', text: 'Tôi bị dị ứng thức ăn, món này có hải sản hoặc đậu phộng không?', category: 'dining' },
  { id: 'dine-9', text: 'Đồ ăn rất ngon, cảm ơn bạn rất nhiều!', category: 'dining' },

  // Trường học
  { id: 'school-1', text: 'Thầy / Cô có thể viết tóm tắt nội dung lên bảng giúp em được không ạ?', category: 'school' },
  { id: 'school-2', text: 'Em xin phép Thầy Cô cho em vào lớp / ra ngoài một chút.', category: 'school' },
  { id: 'school-3', text: 'Bạn cho mình mượn vở ghi chép bài học hôm nay với nhé.', category: 'school' },
  { id: 'school-4', text: 'Hạn chót nộp bài tập này là khi nào vậy các bạn?', category: 'school' },
  { id: 'school-5', text: 'Em có một câu hỏi thắc mắc cần được giải đáp thêm.', category: 'school' },
  { id: 'school-6', text: 'Em đã hiểu bài rồi, em cảm ơn Thầy Cô.', category: 'school' },
  { id: 'school-7', text: 'Nhóm chúng ta sẽ thảo luận ở đâu và vào mấy giờ?', category: 'school' },
  { id: 'school-8', text: 'Cảm ơn Thầy Cô và các bạn đã luôn nhiệt tình hỗ trợ em trong giờ học.', category: 'school' },

  // Di chuyển
  { id: 'trans-1', text: 'Chuyến xe này có đi qua địa chỉ này không ạ?', category: 'transport' },
  { id: 'trans-2', text: 'Làm ơn cho tôi xuống ở điểm dừng tiếp theo.', category: 'transport' },
  { id: 'trans-3', text: 'Vé xe / vé tàu này giá bao nhiêu tiền?', category: 'transport' },
  { id: 'trans-4', text: 'Tôi bị lạc đường, địa điểm này đi hướng nào vậy bạn?', category: 'transport' },
  { id: 'trans-5', text: 'Bạn có thể chỉ đường giúp tôi trên bản đồ điện thoại không?', category: 'transport' },
  { id: 'trans-6', text: 'Bến xe buýt / ga tàu gần nhất nằm ở đâu?', category: 'transport' },
  { id: 'trans-7', text: 'Khoảng bao nhiêu phút nữa thì chuyến xe tiếp theo tới nơi?', category: 'transport' },
  { id: 'trans-8', text: 'Làm ơn gọi giúp tôi một chiếc xe taxi / xe công nghệ về địa chỉ này.', category: 'transport' },

  // Cần trợ giúp
  { id: 'emg-1', text: 'Tôi cần giúp đỡ khẩn cấp!', category: 'emergency' },
  { id: 'emg-2', text: 'Làm ơn gọi giúp tôi xe cấp cứu 115 ngay lập tức!', category: 'emergency' },
  { id: 'emg-3', text: 'Tôi bị đau ở vị trí này, tôi cần được đến bệnh viện gần nhất.', category: 'emergency' },
  { id: 'emg-4', text: 'Tôi bị mất điện thoại và ví tiền, đồn công an gần nhất ở đâu?', category: 'emergency' },
  { id: 'emg-5', text: 'Làm ơn liên hệ giúp tôi với người thân qua số điện thoại này.', category: 'emergency' },
  { id: 'emg-6', text: 'Tôi không nghe được, xin vui lòng hỗ trợ tôi bằng chữ viết.', category: 'emergency' },
  { id: 'emg-7', text: 'Bạn có thể ở lại đây giúp đỡ tôi một lát được không?', category: 'emergency' },
  { id: 'emg-8', text: 'Tôi đã an toàn rồi, cảm ơn sự giúp đỡ kịp thời của bạn!', category: 'emergency' },
];

const CATEGORIES: Array<{ key: CommCategoryKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'favorites', label: 'Yêu thích', icon: Star },
  { key: 'daily', label: 'Hằng ngày', icon: Smile },
  { key: 'shopping', label: 'Mua sắm', icon: ShoppingBag },
  { key: 'dining', label: 'Ăn uống', icon: Utensils },
  { key: 'school', label: 'Trường học', icon: GraduationCap },
  { key: 'transport', label: 'Di chuyển', icon: Bus },
  { key: 'emergency', label: 'Cần trợ giúp', icon: HeartHandshake },
];

export default function QuickCommPage({ onToast }: QuickCommPageProps) {
  const searchInputId = useId();
  // Active selected sentence or custom text
  const [activeText, setActiveText] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<CommCategoryKey>('daily');
  const [searchQuery, setSearchQuery] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Full-screen Big Text Modal
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [bigTextScale, setBigTextScale] = useState<'normal' | 'large' | 'xlarge'>('large');

  // Favorites stored in localStorage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_FAVORITES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    // Defaults on first run
    return ['daily-1', 'daily-5', 'emg-1', 'emg-6'];
  });

  // Custom user-added phrases
  const [customPhrases, setCustomPhrases] = useState<CommItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CUSTOM_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Check speech synthesis support on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !('speechSynthesis' in window)) {
      onToast('info', 'Trình duyệt của bạn hiện chưa hỗ trợ SpeechSynthesis để đọc giọng nói.');
    }
  }, [onToast]);

  // Persist favorites
  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites((prev) => {
      const exists = prev.includes(id);
      const updated = exists ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      onToast(exists ? 'info' : 'success', exists ? 'Đã gỡ khỏi danh sách Yêu thích.' : 'Đã thêm vào câu Yêu thích!');
      return updated;
    });
  };

  // Add custom phrase to library
  const handleSaveCustomPhrase = () => {
    const text = customInput.trim();
    if (!text) {
      onToast('warning', 'Vui lòng nhập nội dung câu trước khi lưu.');
      return;
    }
    const newId = `custom-${Date.now()}`;
    const newItem: CommItem = {
      id: newId,
      text,
      category: activeCategory === 'favorites' ? 'daily' : activeCategory,
      isCustom: true,
    };
    const updated = [newItem, ...customPhrases];
    setCustomPhrases(updated);
    try {
      localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    // Also auto-add to favorites
    if (!favorites.includes(newId)) {
      setFavorites((prev) => {
        const next = [newId, ...prev];
        try {
          localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
    setActiveText(text);
    onToast('success', 'Đã lưu câu tùy chỉnh vào danh sách của bạn!');
  };

  const handleDeleteCustomPhrase = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = customPhrases.filter((p) => p.id !== id);
    setCustomPhrases(updated);
    try {
      localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(updated));
    } catch {}
    setFavorites((prev) => {
      const next = prev.filter((favId) => favId !== id);
      try {
        localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    onToast('info', 'Đã xóa câu tùy chỉnh.');
  };

  // All available items combined
  const allItems = useMemo(() => {
    return [...customPhrases, ...DEFAULT_PRESET_ITEMS];
  }, [customPhrases]);

  // Filtered items based on activeCategory and searchQuery
  const displayedItems = useMemo(() => {
    let list = allItems;
    if (activeCategory === 'favorites') {
      list = list.filter((item) => favorites.includes(item.id));
    } else {
      list = list.filter((item) => item.category === activeCategory);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = allItems.filter((item) => item.text.toLowerCase().includes(q));
    }
    return list;
  }, [activeCategory, allItems, favorites, searchQuery]);

  // Speech-to-Text invocation
  const handleSpeak = (textToSpeak: string) => {
    const clean = textToSpeak.trim();
    if (!clean) {
      onToast('warning', 'Chưa có nội dung câu để phát âm.');
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onToast('error', 'Trình duyệt không hỗ trợ chức năng đọc giọng nói (SpeechSynthesis).');
      return;
    }

    setIsSpeaking(true);
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find((v) => v.lang.toLowerCase().startsWith('vi'));
    if (viVoice) utterance.voice = viVoice;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    onToast('info', `Đang đọc to: "${clean.slice(0, 35)}..."`);
  };

  const handleStopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Copy to clipboard
  const handleCopy = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onToast('success', 'Đã sao chép câu vào bộ nhớ tạm!');
    } catch {
      onToast('error', 'Không thể sao chép văn bản.');
    }
  };

  // Select a preset item
  const handleSelectItem = (item: CommItem) => {
    setActiveText(item.text);
  };

  // Keyboard escape for fullscreen modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenOpen) {
        setIsFullscreenOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenOpen]);

  // Find if activeText matches an existing item for favorite star
  const activeItemId = useMemo(() => {
    const found = allItems.find((i) => i.text === activeText);
    return found ? found.id : null;
  }, [activeText, allItems]);

  const isCurrentActiveFavorite = activeItemId ? favorites.includes(activeItemId) : false;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black tracking-wider uppercase">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>BẢNG GIAO TIẾP NHANH · QUICK COMMUNICATION</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Giao Tiếp Trực Tiếp Bằng Câu Mẫu &amp; Giọng Nói
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Công cụ hỗ trợ giao tiếp tức thì giữa người sử dụng ngôn ngữ ký hiệu và người nghe thông qua các câu giao
              tiếp chọn sẵn, phát âm giọng nói (Text-to-Speech) và hiển thị chữ lớn toàn màn hình.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center gap-1.5 text-emerald-300 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Phát âm tiếng Việt</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center gap-1.5 text-sky-300 font-bold">
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Chữ lớn toàn màn hình</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Communication Stage: Active Selected Phrase & Big Controls */}
      <div className="glass-card rounded-3xl p-5 sm:p-7 border border-slate-800 shadow-2xl relative overflow-hidden bg-slate-900/90">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>KHU VỰC GIAO TIẾP HIỆN TẠI</span>
          </div>
          {activeText && (
            <button
              type="button"
              onClick={() => setActiveText('')}
              className="text-xs font-bold text-slate-400 hover:text-rose-400 inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Xóa câu đang chọn</span>
            </button>
          )}
        </div>

        {/* Display Text Content */}
        {activeText ? (
          <div className="space-y-5">
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/90 border border-emerald-500/40 shadow-inner">
              <p className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-relaxed break-words">
                &ldquo;{activeText}&rdquo;
              </p>
            </div>

            {/* Action Bar with Large Ergonomic Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => (isSpeaking ? handleStopSpeaking() : handleSpeak(activeText))}
                className={`min-h-[48px] px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer transition-all shadow-lg ${
                  isSpeaking
                    ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:shadow-emerald-500/20'
                }`}
              >
                {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                <span>{isSpeaking ? 'Dừng phát âm' : 'Đọc thành tiếng (Phát âm)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreenOpen(true)}
                className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer transition-all shadow-lg hover:shadow-sky-500/20"
              >
                <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Hiện chữ lớn toàn màn hình</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopy(activeText)}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép'}</span>
              </button>

              {activeItemId && (
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(activeItemId, e)}
                  className={`min-h-[48px] px-4 py-2.5 rounded-2xl border font-bold text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer transition-colors ${
                    isCurrentActiveFavorite
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  }`}
                >
                  <Star className={`w-4 h-4 ${isCurrentActiveFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                  <span>{isCurrentActiveFavorite ? 'Đã lưu yêu thích' : 'Lưu yêu thích'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 sm:py-10 px-4 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
              <MessageSquare className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">Chưa chọn câu giao tiếp nào</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Hãy bấm vào bất kỳ câu mẫu nào ở danh sách bên dưới hoặc nhập câu bạn muốn nói vào ô tùy chỉnh. Câu sẽ lập
              tức xuất hiện ở đây để bạn phát âm hoặc phóng to toàn màn hình.
            </p>
          </div>
        )}
      </div>

      {/* Custom Sentence Input Section */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 border border-slate-800 bg-slate-900/80 space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="custom-comm-input" className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-sky-400" />
            <span>NHẬP CÂU TÙY CHỈNH THEO Ý BẠN</span>
          </label>
          {customInput && (
            <button
              type="button"
              onClick={() => setCustomInput('')}
              className="text-xs text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
            >
              Xóa trắng ô nhập
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            id="custom-comm-input"
            rows={2}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Gõ nội dung bạn muốn truyền đạt tại đây (ví dụ: Địa chỉ của tôi là 123 đường ABC, Cho tôi hỏi...)..."
            className="flex-1 p-3.5 rounded-2xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none"
          />

          <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (customInput.trim()) {
                  setActiveText(customInput.trim());
                  handleSpeak(customInput.trim());
                } else {
                  onToast('warning', 'Vui lòng nhập nội dung trước.');
                }
              }}
              className="flex-1 sm:flex-none min-h-[42px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              <span>Đọc to ngay</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (customInput.trim()) {
                  setActiveText(customInput.trim());
                  setIsFullscreenOpen(true);
                } else {
                  onToast('warning', 'Vui lòng nhập nội dung trước.');
                }
              }}
              className="flex-1 sm:flex-none min-h-[42px] px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Chữ lớn</span>
            </button>

            <button
              type="button"
              onClick={handleSaveCustomPhrase}
              className="flex-1 sm:flex-none min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Star className="w-4 h-4 text-amber-400" />
              <span>Lưu câu này</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Tabs Scrollable */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key && !searchQuery.trim();
              const count =
                cat.key === 'favorites'
                  ? favorites.length
                  : allItems.filter((item) => item.category === cat.key).length;

              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.key);
                    setSearchQuery('');
                  }}
                  className={`min-h-[42px] px-3.5 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all shrink-0 ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search Bar */}
          <div className="relative sm:w-72 shrink-0">
            <label htmlFor={searchInputId} className="sr-only">
              Tìm kiếm câu giao tiếp
            </label>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm câu giao tiếp..."
              className="w-full min-h-[42px] pl-9 pr-8 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Phrase Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {displayedItems.length > 0 ? (
            displayedItems.map((item) => {
              const isFav = favorites.includes(item.id);
              const isSelected = activeText === item.text;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className={`group relative rounded-2xl p-4 sm:p-5 border cursor-pointer transition-all duration-200 flex flex-col justify-between gap-3 text-left ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50'
                      : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-800 hover:border-slate-700 shadow-md'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {item.isCustom ? 'Câu của bạn' : CATEGORIES.find((c) => c.key === item.category)?.label}
                      </span>
                      <div className="flex items-center gap-1">
                        {item.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomPhrase(item.id, e)}
                            title="Xóa câu này"
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(item.id, e)}
                          title={isFav ? 'Bỏ yêu thích' : 'Lưu yêu thích'}
                          className="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                          <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                        </button>
                      </div>
                    </div>

                    <p
                      className={`text-sm sm:text-base font-bold leading-snug ${
                        isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                      }`}
                    >
                      {item.text}
                    </p>
                  </div>

                  {/* Card Action Footers */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
                    <span className="text-[11px] text-emerald-400 font-bold group-hover:underline">
                      {isSelected ? '✓ Đang chọn' : 'Bấm để chọn'}
                    </span>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveText(item.text);
                          handleSpeak(item.text);
                        }}
                        title="Đọc to câu này"
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 transition-colors cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveText(item.text);
                          setIsFullscreenOpen(true);
                        }}
                        title="Hiện chữ lớn toàn màn hình"
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-300 transition-colors cursor-pointer"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(item.text)}
                        title="Sao chép câu"
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12 px-4 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
                <AlertCircle className="w-6 h-6 text-slate-400" />
              </div>
              <h4 className="text-base font-bold text-white">Không tìm thấy câu nào phù hợp</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {activeCategory === 'favorites'
                  ? 'Bạn chưa lưu câu yêu thích nào. Hãy nhấn biểu tượng ngôi sao ⭐ trên các câu giao tiếp để lưu lại dùng nhanh.'
                  : 'Hãy thử tìm kiếm bằng từ khóa khác hoặc nhập câu mới vào ô tùy chỉnh phía trên.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Safety Notice & Disclaimer */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 flex items-start gap-3 text-xs text-slate-400">
        <AlertCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-200">Lưu ý về tính năng:</strong> Đây là công cụ hỗ trợ giao tiếp trực tiếp qua
          các câu thông dụng, văn bản và giọng nói tổng hợp (Text-to-Speech). SignLens không tự nhận văn bản đã được
          chuyển thành video ngôn ngữ ký hiệu hoàn chỉnh khi chưa có mô hình dịch được kiểm chứng.
        </p>
      </div>

      {/* Full-screen Big Text Modal */}
      {isFullscreenOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fullscreen-big-text-title"
          className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-xl flex flex-col justify-between p-6 sm:p-10 animate-fade-in"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <span id="fullscreen-big-text-title" className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black uppercase">
                Chế độ chữ lớn toàn màn hình
              </span>

              {/* Text Size Switcher */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setBigTextScale('normal')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    bigTextScale === 'normal' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Vừa
                </button>
                <button
                  type="button"
                  onClick={() => setBigTextScale('large')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    bigTextScale === 'large' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Lớn
                </button>
                <button
                  type="button"
                  onClick={() => setBigTextScale('xlarge')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    bigTextScale === 'xlarge' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cực lớn
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsFullscreenOpen(false)}
              aria-label="Đóng màn hình chữ lớn"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Đóng (Esc)</span>
            </button>
          </div>

          {/* Big Text Center Display */}
          <div className="flex-1 flex items-center justify-center py-8 px-4 text-center">
            <p
              className={`font-black text-white leading-tight tracking-tight max-w-5xl select-all ${
                bigTextScale === 'normal'
                  ? 'text-2xl sm:text-4xl md:text-5xl'
                  : bigTextScale === 'large'
                    ? 'text-3xl sm:text-5xl md:text-6xl'
                    : 'text-4xl sm:text-6xl md:text-7xl lg:text-8xl'
              }`}
            >
              {activeText || 'Chưa có nội dung để hiển thị.'}
            </p>
          </div>

          {/* Modal Footer Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => (isSpeaking ? handleStopSpeaking() : handleSpeak(activeText))}
              className={`min-h-[50px] px-6 py-3 rounded-2xl font-black text-sm inline-flex items-center gap-2 cursor-pointer transition-all shadow-xl ${
                isSpeaking
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              <span>{isSpeaking ? 'Dừng phát âm' : 'Đọc to lại câu này'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopy(activeText)}
              className="min-h-[50px] px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-sm inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép văn bản'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreenOpen(false)}
              className="min-h-[50px] px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>Quay lại bảng</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
