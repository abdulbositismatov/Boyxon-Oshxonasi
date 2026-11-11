# Render keep-alive (Cloudflare Worker)

Render free-tier `boyxon-server` servisi 15 daqiqa inbound trafik olmasa uxlaydi.
Bu Worker Cron Trigger orqali har 5 daqiqada `https://boyxon-server.onrender.com/health`
ni chaqiradi va servisni uyg'oq ushlab turadi.

## Deploy

```bash
cd ops/render-keepalive
npx wrangler deploy
```

## Tekshirish

- Worker: <https://boyxon-keepalive.nmatullohmansurov.workers.dev>
- Cron jadvali: `*/5 * * * *` (UTC)

## O'chirish

```bash
cd ops/render-keepalive
npx wrangler delete
```

> Render bepul limiti: 750 instance-hour/oy. 24/7 ishlash ~744 soat —
> bitta free web service uchun limitga sig'adi.
