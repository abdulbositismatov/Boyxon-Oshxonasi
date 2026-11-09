import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { chatApi } from '../../api/chat.api';
import { useChatSocket, useChatTyping, setChatOpen, isChatOpen } from '../../hooks/useChatSocket';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
import { useCartStore } from '../../store/cart.store';
import { useUiStore } from '../../store/ui.store';
import type { ChatMessage } from '../../types';

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Mijoz uchun floating chat widget (support bilan real-time suhbat). */
export function ChatWidget() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { pathname } = useLocation();
  const token = useAuthStore((s) => s.accessToken);
  // Savat sahifasidagi checkout paneli faqat savat bo'sh bo'lmaganda chiziladi.
  // Shunga mos ravishda chat tugmasi ham panel ustiga ko'tariladi.
  const hasCartLines = useCartStore((s) => s.lines.length > 0);
  const aboveCartPanel = pathname === '/cart' && hasCartLines;
  const { chatOpen, set } = useUiStore();
  const open = chatOpen;
  const setOpen = (v: boolean) => set({ chatOpen: v });
  const [draft, setDraft] = useState('');
  const [adminTyping, setAdminTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['chat-me'],
    queryFn: () => chatApi.myConversation(),
    enabled: Boolean(token),
    staleTime: Infinity,
  });

  const messages: ChatMessage[] = data?.data.messages ?? [];
  const conversationId = data?.data.conversation?._id;

  useEffect(() => {
    setChatOpen(open);
  }, [open]);

  const socket = useChatSocket(
    {
      onMessage: () => {
        void qc.invalidateQueries({ queryKey: ['chat-me'] });
      },
      onTyping: () => {
        setAdminTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setAdminTyping(false), 2500);
      },
    },
    Boolean(token),
  );
  const emitTyping = useChatTyping(socket);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, adminTyping, open]);

  const send = (): void => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const optimistic: ChatMessage = {
      _id: `tmp-${Date.now()}`,
      conversation: conversationId ?? '',
      sender: 'me',
      senderRole: 'user',
      text,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    qc.setQueryData<{ data: { conversation: unknown; messages: ChatMessage[] } } | undefined>(
      ['chat-me'],
      (old) => (old ? { ...old, data: { ...old.data, messages: [...old.data.messages, optimistic] } } : old),
    );
    chatApi
      .sendUserMessage(text)
      .then(() => void qc.invalidateQueries({ queryKey: ['chat-me'] }))
      .catch(() => void qc.invalidateQueries({ queryKey: ['chat-me'] }));
  };

  if (!token) return null;


  return (
    <>
      {/* Desktop uchun burchakdagi floating tugma (mobilda bottom nav'da joylashgan) */}
      {!open && (
        <button type="button"
          onClick={() => setOpen(true)}
          className="fixed right-5 z-40 hidden md:grid h-12 w-12 place-items-center rounded-full bg-gradient-to-r from-primary-700 to-primary-800 text-white shadow-lg transition hover:scale-105 active:scale-95 md:bottom-5"
          aria-label={t('chat.open')}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Zamonaviy animatsiyali Chatbar — butun ekran emas, qulay pastki panel (Bottom Sheet) */}
      <AnimatePresence>
        {open && (
          <div className="pointer-events-auto fixed inset-0 z-50 flex flex-col justify-end p-3 pb-[calc(5.25rem_+_env(safe-area-inset-bottom,0px))] sm:items-end sm:justify-end sm:p-5">
            {/* Orqa fonni xiralashtiruvchi qatlam (tashqariga bosilganda chat yopiladi) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
            />

            {/* Suzib turuvchi karta — ekranga yopishmaydi, lekin joyidan siljimaydi */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative z-10 mx-auto flex h-[76vh] max-h-[620px] min-h-[440px] w-full max-w-lg origin-bottom flex-col overflow-hidden rounded-[28px] border border-ink-line/50 bg-surface shadow-2xl sm:h-[560px] sm:max-h-[85vh] sm:w-[390px] sm:origin-bottom-right sm:rounded-3xl"
            >
              {/* Sarlavha paneli */}
              <div className="flex items-center gap-3 bg-gradient-to-r from-primary-700 via-primary-750 to-primary-800 px-5 py-3 text-white">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 shadow-sm">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold tracking-tight">{t('chat.support')}</p>
                  <p className="flex items-center gap-1.5 text-xs text-white/90">
                    <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    {t('chat.online')}
                  </p>
                </div>
                <button type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2 transition-colors hover:bg-white/20 active:scale-90"
                  aria-label={t('common.close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Xabarlar ro'yxati */}
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-bg p-4 overscroll-contain">
                {isLoading && (
                  <div className="flex h-full items-center justify-center text-ink-300">
                    <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                  </div>
                )}
                {!isLoading && !messages.length && (
                  <div className="py-12 text-center">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-raised shadow-inner">
                      <MessageCircle className="h-7 w-7 text-primary-600" />
                    </div>
                    <p className="mt-3 font-semibold text-ink-900">{t('chat.title')}</p>
                    <p className="mt-1 text-xs text-ink-300 max-w-[240px] mx-auto">{t('chat.welcome')}</p>
                  </div>
                )}
                {messages.map((m) => {
                  const mine = m.senderRole === 'user';
                  return (
                    <motion.div
                      key={m._id}
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.15 }}
                      className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm transition-all',
                          mine
                            ? 'rounded-br-sm bg-gradient-to-r from-primary-700 to-primary-800 text-white'
                            : 'rounded-bl-sm bg-surface-raised text-ink-900 border border-ink-line/30',
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p className={cn('mt-1 text-[10px] text-right', mine ? 'text-white/80' : 'text-ink-300')}>
                          {time(m.createdAt)}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                {adminTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-surface-raised px-4 py-2.5 border border-ink-line/30">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-ink-300" />
                    </div>
                  </div>
                )}
              </div>

              {/* Yozish maydoni (Input) */}
              <form
                className="flex items-center gap-2 border-t border-ink-line/40 bg-surface p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom,0px))]"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    emitTyping('admin');
                  }}
                  placeholder={t('chat.placeholder')}
                  className="h-11 flex-1 rounded-full border border-ink-line/60 bg-bg px-4 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-r from-primary-700 to-primary-800 text-white shadow-md transition hover:scale-105 active:scale-90 disabled:opacity-40"
                  aria-label={t('chat.send')}
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
