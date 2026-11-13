# Production'ga chiqarish — 100% bepul arxitektura

Bu hujjat Boyxon Oshxonasi'ni **to'liq bepul** tariflarda productionga
chiqarish uchun qadam-baqadam qo'llanma.

## Arxitektura

```
Foydalanuvchi
      │
      ▼
Render Web Service (bepul, 512MB)
  ├── Express API  /api/*
  ├── SPA (React build) — bitta origin
  └── WebSocket    /ws
      │
      ├── MongoDB Atlas M0 (bepul, 512MB)
      ├── Cloudflare Worker: boyxon-media → KV (rasmlar, bepul)
      └── Resend (email, bepul 100 xat/kun)

Cloudflare Worker: boyxon-keepalive (cron, bepul)
      └── 06:00–20:00 har 5 daqiqada Render'ni uyg'oq tutadi
```

## Bepul limitlar

| Xizmat | Bepul limit | Bu loyihada sarf |
|---|---|---|
| Render Web Service | 750 soat/oy | ~420 soat (06:00–20:00) |
| MongoDB Atlas M0 | 512 MB | kichik restoran uchun yetarli |
| Cloudflare Workers | 100 000 so'rov/kun | media + keep-alive |
| Cloudflare KV | 1 GB, 100k o'qish/kun, 1k yozish/kun | menyu rasmlari |
| Resend | 100 xat/kun | tasdiqlash + buyurtma xatlari |
| GitHub Actions | 2000 daqiqa/oy (public repo: cheksiz) | CI + kunlik backup |

**Pullik xizmat yo'q.** Cloudflare R2 va Atlas backup kabi pullik/to'lov usuli
talab qiladigan variantlar ishlatilmaydi.

---

## 1. Render (asosiy server)

`render.yaml` Blueprint orqali servis yaratiladi. Dashboard → **Environment**
bo'limida quyidagilar `sync: false` bilan qo'shiladi:

### Majburiy

| Kalit | Qiymat |
|---|---|
| `MONGODB_URI` | `mongodb+srv://...` (Atlas) |
| `JWT_ACCESS_SECRET` | 48+ belgi |
| `JWT_REFRESH_SECRET` | 48+ belgi (boshqasidan farq qiladi) |
| `JWT_RESET_SECRET` | 48+ belgi |
| `JWT_EMAIL_VERIFY_SECRET` | 48+ belgi |
| `ADMIN_EMAIL` | admin emailingiz |
| `ADMIN_PASSWORD` | 12+ belgi, kuchli |

Kalit generatsiya:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Email (Render'da SMTP bloklangan — HTTP provayder SHART)

| Kalit | Qiymat |
|---|---|
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | `re_...` |
| `EMAIL_FROM` | `Boyxon Oshxonasi <no-reply@sizningdomen.uz>` |

Resend'da domen tasdiqlanmaguncha faqat o'z emailingizga xat yuborish mumkin.
Domen yo'q bo'lsa, `onboarding@resend.dev` dan foydalaning (test uchun).

### Rasmlar (media worker)

| Kalit | Qiymat |
|---|---|
| `MEDIA_WORKER_URL` | `https://boyxon-media.nmatullohmansurov.workers.dev` |
| `MEDIA_WORKER_SECRET` | lokal `.media-secret.txt` faylida |

> `.media-secret.txt` git'ga tushmaydi (`.gitignore` da). Uni Render'dagi
> `MEDIA_WORKER_SECRET` ga nusxalang va xavfsiz saqlang.

### Ixtiyoriy

| Kalit | Maqsad |
|---|---|
| `ALERT_WEBHOOK_URL` | Discord/Slack webhook — kritik xatolar |
| `RESTAURANT_LAT` / `RESTAURANT_LNG` | masofa hisobi uchun |
| `VAPID_*` | push bildirishnomalar |
| `GOOGLE_CLIENT_*` | Google bilan kirish |

---

## 2. Cloudflare media worker

Allaqachon deploy qilingan:

```
https://boyxon-media.nmatullohmansurov.workers.dev
```

Qayta deploy kerak bo'lsa:

```bash
cd ops/media-worker
npx wrangler deploy
```

Batafsil: [ops/media-worker/README.md](ops/media-worker/README.md).

---

## 3. Keep-alive (Render uxlab qolmasin)

```bash
cd ops/render-keepalive
npx wrangler deploy
```

Cron: `*/5 1-14 * * *` — Toshkent vaqti bilan 06:00–19:55.

---

## 4. Backup

`.github/workflows/backup.yml` har kuni 03:00 (Toshkent) da `mongodump`
qiladi va arxivni 30 kun GitHub artifact sifatida saqlaydi.

Kerak: repo → Settings → Secrets → `MONGODB_URI`.

Tiklash:

```bash
mongorestore --uri="<MONGODB_URI>" --archive=boyxon-YYYYMMDD-HHMMSS.gz --gzip
```

---

## 5. CI va branch protection

- `main` himoyalangan: PR + 2 ta majburiy check
  (`Lint + test + build`, `Xavfsizlik auditi`).
- `npm audit --audit-level=high` — high/critical zaiflik bo'lsa deploy bloklanadi.
- Render `autoDeployTrigger: checksPass` — faqat CI yashil bo'lsa deploy.

---

## 6. Go-live checklist

- [ ] Barcha sekretlar Render'da kiritilgan
- [ ] `https://<server>/health` → 200 va `db: "up"`
- [ ] Resend'dan test xat yuborildi
- [ ] Admin panelda bitta taom rasmi yuklandi va u `boyxon-media...` URL'da ochildi
- [ ] Render'ni qayta deploy qilib, rasm saqlanib qolganini tekshirish
  (ephemeral disk muammosi yopilganini tasdiqlaydi)
- [ ] Test buyurtma: to'lov usuli, yetkazish narxi, ETA to'g'ri
- [ ] Admin panelda oshxona ochiq/yopiq va tarif sozlamalari ishlaydi
- [ ] `npm audit --omit=dev` → 0 zaiflik
- [ ] MongoDB Atlas'da IP whitelist: `0.0.0.0/0` (Render IP'lari dinamik)
- [ ] Atlas'da kuchli parol va alohida foydalanuvchi (admin huquqisiz)

---

## Ma'lum cheklovlar (halol)

| Muammo | Holat |
|---|---|
| Payme/Click/Uzum | Faqat yorliq — real gateway shartnoma talab qiladi |
| Fiskal chek | Yo'q — soliq integratsiyasi alohida |
| Kuryer kuzatuvi | Yo'q — status orqali kuzatiladi |
| Admin 2FA | Yo'q — kuchli parol + rate-limit bilan cheklangan |
| Render free cold start | ~30–50s (keep-alive 06:00–20:00 da oldini oladi) |
| Atlas M0 backup | Avtomatik emas — GitHub Action kunlik dump qiladi |
