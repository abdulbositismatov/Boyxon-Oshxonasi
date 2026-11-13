# Boyxon media worker

Rasmlar uchun Cloudflare Worker + KV (yoki R2). Render'dagi ephemeral disk
muammosini hal qiladi, O'zbekistonda ishlaydi va **to'lov usuli talab qilmaydi**.

## 1. KV namespace yaratish (bir marta)

```bash
npx wrangler kv namespace create MEDIA
```

Chiqqan `id` ni `wrangler.jsonc` dagi `kv_namespaces[0].id` ga qo'ying.

## 2. Maxfiy kalitni o'rnatish

```bash
# Kuchli kalit generatsiya qilish
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npx wrangler secret put MEDIA_SECRET
# so'ralganda yuqoridagi kalitni yopishtiring
```

## 3. Deploy

```bash
npx wrangler deploy
```

Natijada manzil chiqadi:

```
https://boyxon-media.<subdomain>.workers.dev
```

## 4. Server sozlamalari (Render → Environment)

```
MEDIA_WORKER_URL    = https://boyxon-media.<subdomain>.workers.dev
MEDIA_WORKER_SECRET = <2-qadamdagi kalit>
MEDIA_PUBLIC_URL    = (ixtiyoriy, custom CDN domen bo'lsa)
```

## Bepul limitlar (KV)

| Parametr | Bepul limit |
|---|---|
| Saqlash | 1 GB |
| O'qish | 100 000 / kun |
| Yozish | 1 000 / kun |
| O'chirish | 1 000 / kun |

Kichik restoran menyusi uchun yetarli (100 ta rasm × ~500KB ≈ 50MB).

## R2 ga o'tish (ixtiyoriy)

R2 10GB beradi, lekin Cloudflare dashboard'da R2'ni yoqish (to'lov usuli)
talab qilinadi. Yoqilgandan keyin `wrangler.jsonc` da KV o'rniga:

```jsonc
"r2_buckets": [{ "binding": "MEDIA", "bucket_name": "boyxon-media" }]
```

Worker kodi ikkala saqlashni ham qo'llab-quvvatlaydi.
