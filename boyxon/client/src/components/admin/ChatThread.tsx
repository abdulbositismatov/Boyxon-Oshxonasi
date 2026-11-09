import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { chatApi } from '../../api/chat.api';
import { UserAvatar } from '../ui/UserAvatar';
import { useChatSocket, useChatTyping } from '../../hooks/useChatSocket';
import { cn } from '../../lib/utils';
import type { ChatMessage, ChatUser } from '../../types';

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Admin uchun bitta suhbat xabar oynasi. */
export function ChatThread({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [userTyping, setUserTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-conversation', conversationId],
    queryFn: () => chatApi.conversation(conversationId),
    staleTime: Infinity,
  });

  const messages: ChatMessage[] = data?.data.messages ?? [];
  const user = (data?.data.conversation.user ?? null) as ChatUser | null;

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['admin-conversation', conversationId] });
    void qc.invalidateQueries({ queryKey: ['admin-conversations'] });
  }, [qc, conversationId]);

  const socket = useChatSocket({
    onMessage: (p) => {
      const msg = p.message as ChatMessage | undefined;
      if (msg && !msg._id.startsWith('tmp-')) {
        qc.setQueryData<{ data: { conversation: unknown; messages: ChatMessage[] } } | undefined>(
          ['admin-conversation', conversationId],
          (old) => (old ? { ...old, data: { ...old.data, messages: [...old.data.messages, msg] } } : old),
        );
      }
      setUserTyping(false);
      invalidate();
    },
    onTyping: () => {
      setUserTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setUserTyping(false), 2500);
    },
  });
  const emitTyping = useChatTyping(socket);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, userTyping]);

  const send = (): void => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const optimistic: ChatMessage = {
      _id: `tmp-${Date.now()}`,
      conversation: conversationId,
      sender: 'me',
      senderRole: 'admin',
      text,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    qc.setQueryData<{ data: { conversation: unknown; messages: ChatMessage[] } } | undefined>(
      ['admin-conversation', conversationId],
      (old) => (old ? { ...old, data: { ...old.data, messages: [...old.data.messages, optimistic] } } : old),
    );
    chatApi
      .sendAdminMessage(conversationId, text)
      .then(() => invalidate())
      .catch(() => {
        toast.error(t('chat.send_error'));
        invalidate();
      });
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-ink-line px-4 py-3">
        <Button onClick={onBack} className="rounded-full p-1.5 hover:bg-surface-raised md:hidden" aria-label={t('common.back')}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <UserAvatar src={user?.avatar} name={user?.name} className="h-10 w-10" viewable />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink-900">{user?.name ?? t('chat.unknown_user')}</p>
          {user?.phone && <p className="truncate text-xs text-ink-300">{user.phone}</p>}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-bg p-4"
      >
        {isLoading && (
          <div className="flex h-full items-center justify-center text-ink-300">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {messages.map((m) => {
          const mine = m.senderRole === 'admin';
          return (
            <div
              key={m._id}
              className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start')}
            >
              {!mine && (
                <UserAvatar
                  src={user?.avatar}
                  name={user?.name}
                  className="h-7 w-7 text-[10px]"
                  viewable
                />
              )}
              <div
                className={cn(
                  'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                  mine
                    ? 'rounded-br-md bg-gradient-to-r from-[#E67E22] to-[#F39C12] text-white'
                    : 'rounded-bl-md bg-surface-raised text-ink-900',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className={cn('mt-1 text-[10px]', mine ? 'text-white/70' : 'text-ink-300')}>{time(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        {userTyping && (
          <div className="flex items-end justify-start gap-2">
            <UserAvatar src={user?.avatar} name={user?.name} className="h-7 w-7 text-[10px]" />
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface-raised px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-ink-300" />
            </div>
          </div>
        )}
      </div>

      <form
        className="sticky bottom-0 z-10 flex shrink-0 items-center gap-2 border-t border-ink-line bg-surface p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            emitTyping(user?._id);
          }}
          placeholder={t('chat.placeholder')}
          className="h-11 flex-1 rounded-full border border-ink-line bg-bg px-4 text-sm outline-none focus:border-primary-500"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-r from-[#E67E22] to-[#F39C12] text-white transition disabled:opacity-40"
          aria-label={t('chat.send')}
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}

