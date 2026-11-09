import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { chatApi } from '../../api/chat.api';
import { ChatThread } from '../../components/admin/ChatThread';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { useChatSocket } from '../../hooks/useChatSocket';
import { cn } from '../../lib/utils';
import type { ChatConversation, ChatUser } from '../../types';

/** Admin chat — suhbatlar ro'yxati (chap) + tanlangan suhbat xabar oynasi (o'ng). */
export default function AdminChat() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-conversations', search],
    queryFn: () => chatApi.conversations({ search, limit: 50 }),
  });

  // Real-time — yangi xabar kelganda ro'yxat yangilanadi.
  useChatSocket(
    {
      onMessage: () => void qc.invalidateQueries({ queryKey: ['admin-conversations'] }),
      onConversationUpdated: () => void qc.invalidateQueries({ queryKey: ['admin-conversations'] }),
    },
    true,
  );

  const conversations = (data?.data ?? []) as (ChatConversation & { user: ChatUser })[];
  const selected = conversations.find((c) => c._id === selectedId) ?? null;

  return (
    <div className="grid h-[calc(100dvh-9rem)] grid-cols-1 gap-4 overflow-hidden md:h-[calc(100vh-8rem)] md:grid-cols-[320px_1fr]">
      {/* Suhbatlar ro'yxati — mobilde suhbat tanlanganda to'liq oynaga o'tadi. */}
      <div
        className={cn(
          'flex min-h-0 flex-col overflow-hidden rounded-card bg-surface shadow-sm',
          selected && 'hidden md:flex',
        )}
      >
        <div className="border-b border-ink-line p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('chat.search')}
              className="h-10 w-full rounded-full border border-ink-line bg-bg pl-9 pr-3 text-sm outline-none focus:border-primary-500"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && <p className="p-6 text-center text-sm text-ink-300">{t('common.loading')}</p>}
          {!isLoading && !conversations.length && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="h-10 w-10 text-ink-300" />
              <p className="mt-2 text-sm text-ink-300">{t('chat.no_conversations')}</p>
            </div>
          )}
          {conversations.map((c) => {
            const u = typeof c.user === 'object' ? c.user : null;
            return (
              <button
                type="button"
                key={c._id}
                onClick={() => setSelectedId(c._id)}
                className={cn(
                  'flex w-full items-center gap-3 border-b border-ink-line/60 px-3 py-3 text-left transition hover:bg-surface-raised',
                  selectedId === c._id && 'bg-primary-50 text-primary-800',
                )}
              >
                <UserAvatar src={u?.avatar} name={u?.name} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-ink-900">{u?.name ?? t('chat.unknown_user')}</p>
                    {c.adminUnread > 0 && (
                      <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                        {c.adminUnread}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-ink-300">
                    {c.lastSenderRole === 'admin' ? `${t('chat.you')}: ` : ''}
                    {c.lastMessage || '—'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Xabar oynasi — mobilde ro'yxat ustida emas, alohida to'liq oyna. */}
      <div
        className={cn(
          'min-h-0 overflow-hidden rounded-card bg-surface shadow-sm',
          !selected && 'hidden md:block',
        )}
      >
        {selected ? (
          <ChatThread conversationId={selected._id} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageCircle className="h-12 w-12 text-ink-300" />
            <p className="mt-3 text-sm text-ink-300">{t('chat.select_conversation')}</p>
            <button type="button" onClick={() => nav('/')} className="mt-4 text-sm font-medium text-primary-600">
              {t('chat.back_to_site')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

