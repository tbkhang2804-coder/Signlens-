import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { generateSignBotFallbackReply } from '../utils/signbotFallback';
import { SendSvg, SignBotSvg } from './Icons';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  origin?: 'gemini' | 'fallback';
}

const SUGGESTIONS = [
  'Cách học qua YouTube?',
  'Camera chưa hoạt động?',
  'Cách gọi video 2 chiều?',
  'Huấn luyện trong Studio?',
];

export default function SignBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Xin chào! Tôi là SignBot — trợ lý ảo của SignLens. Tôi có thể giúp bạn sử dụng camera nhận diện, gọi video, học ký hiệu qua YouTube hoặc giải đáp thắc mắc về ứng dụng.',
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

  const sendMessage = async (rawText?: string) => {
    const query = (rawText ?? input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: query,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!rawText) setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: query,
          history: nextMessages.slice(-6).map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        }),
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as { reply?: string };
        if (data.reply) {
          setMessages((prev) => [
            ...prev,
            {
              id: `b_${Date.now()}`,
              sender: 'bot',
              text: data.reply!,
              origin: 'gemini',
            },
          ]);
          setIsLoading(false);
          return;
        }
      }

      // Engage authentic SignBot rule-based fallback
      const fallbackText = generateSignBotFallbackReply(query);
      setMessages((prev) => [
        ...prev,
        {
          id: `b_${Date.now()}`,
          sender: 'bot',
          text: fallbackText,
          origin: 'fallback',
        },
      ]);
    } catch {
      const fallbackText = generateSignBotFallbackReply(query);
      setMessages((prev) => [
        ...prev,
        {
          id: `b_${Date.now()}`,
          sender: 'bot',
          text: fallbackText,
          origin: 'fallback',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-[70px] right-3 lg:bottom-5 lg:right-5 z-40 flex flex-col items-end gap-2.5 sm:gap-3">
      {isOpen && (
        <section
          aria-label="Trợ lý SignLens SignBot"
          className="w-[calc(100vw-24px)] sm:w-[376px] max-h-[68dvh] sm:max-h-[500px] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                <SignBotSvg className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Trợ lý SignLens
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hỗ trợ hướng dẫn &amp; giải đáp
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Thu gọn trợ lý"
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-3 space-y-3 bg-white dark:bg-slate-900 min-h-[200px] sm:min-h-[240px] max-h-[300px]"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                    msg.sender === 'user'
                      ? 'bg-sky-600 text-white rounded-br-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
                {msg.origin === 'fallback' && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                    Trả lời từ bộ hướng dẫn SignBot
                  </span>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  SignBot đang soạn câu trả lời...
                </div>
              </div>
            )}
          </div>

          {/* Suggestions */}
          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap bg-slate-50/70 dark:bg-slate-950/30">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-sky-500 dark:hover:border-sky-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi cho SignBot..."
              className="flex-1 h-10 sm:h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Gửi câu hỏi"
              className="h-10 sm:h-9 px-3.5 sm:px-3 inline-flex items-center justify-center rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white transition-colors cursor-pointer"
            >
              <SendSvg className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Mở Trợ lý SignLens"
        title="Trợ lý SignLens"
        className="w-12 h-12 sm:w-auto sm:h-12 sm:px-4 rounded-full bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white shadow-xl border border-slate-700/40 dark:border-sky-400/30 inline-flex items-center justify-center gap-2.5 text-sm font-semibold transition-transform active:scale-95 cursor-pointer"
      >
        <SignBotSvg className="w-5 h-5" />
        <span className="hidden sm:inline whitespace-nowrap">Trợ lý SignLens</span>
      </button>
    </div>
  );
}
