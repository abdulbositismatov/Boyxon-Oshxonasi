import { useRef, useState } from 'react';
import { Camera, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { User as UserType } from '../../types';
import { Card } from '../ui/Card';
import { usersApi } from '../../api/users.api';
import { useAuthStore } from '../../store/auth.store';
import { formatPrice, tVal } from '../../lib/format';

/** Avatar serverda 150 000 belgi bilan cheklangan — sig'dirilgan rasm shundan kichik bo'lsin. */
const AVATAR_MAX_CHARS = 140_000;
/** Avatar ko'rsatilishi 64px; 512px retina uchun yetarli, JPEG siqilgan holda kichik bo'ladi. */
const AVATAR_MAX_SIDE = 512;

/**
 * Rasmni canvas orqali kvadratga yaqin kichraytirib, JPEG data-URL qaytaradi.
 * Sabab: xom fayl base64 holda server limitidan oshib ketadi (avval avatar
 * yuklash umuman ishlamas edi — 5 MB fayl ~7 MB base64 bo'lardi).
 */
async function compressAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-context');
  // JPEG shaffoflikni qo'llamaydi — fon oq bo'lsin (aks holda qora chiqadi).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Sifatni bosqichma-bosqich tushiramiz — limitdan oshsa yana kichraytiramiz.
  for (const quality of [0.85, 0.7, 0.55]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= AVATAR_MAX_CHARS) return url;
  }
  return canvas.toDataURL('image/jpeg', 0.45);
}

export function ProfileCard({ user }: { user: UserType }) {
  const { t } = useTranslation();
  const setUser = useAuthStore((s) => s.setUser);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onPick = async (file?: File): Promise<void> => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.image_type_error'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.image_too_large'));
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await compressAvatar(file);
      const r = await usersApi.updateMe({ avatar: dataUrl });
      setUser(r.data);
      toast.success(t('profile.avatar_updated'));
    } catch {
      toast.error(t('profile.avatar_error'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="relative">
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary-100 text-primary-600">
            <User className="h-8 w-8" />
          </div>
        )}
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-ink-line bg-surface text-ink-700 shadow-sm hover:bg-surface-raised disabled:opacity-60"
          aria-label={t('profile.upload_avatar')}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { void onPick(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-bold text-ink-900">{user.name}</p>
        <p className="truncate text-sm text-ink-300">{user.email}</p>
        <p className="mt-0.5 text-sm font-medium text-primary-600">{tVal(t('profile.bonus'), { amount: formatPrice(user.bonusBalance ?? 0) })}</p>
      </div>
    </Card>
  );
}
