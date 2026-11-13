# Boyxon Oshxonasi

[![CI](https://github.com/mansurvv710/Boyxon-Oshxonasi/actions/workflows/ci.yml/badge.svg)](https://github.com/mansurvv710/Boyxon-Oshxonasi/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

O'zbek milliy taomlarini (palov, somsa, kabob va boshqalar) Toshkent bo'ylab yetkazib beruvchi **to'liq funktsional full-stack platforma**.

## 🚀 Tez boshlash (lokal)

```bash
# 1) Reponi klonlash
git clone https://github.com/mansurvv710/Boyxon-Oshxonasi.git
cd Boyxon-Oshxonasi

# 2) Barcha bog'liqliklarni o'rnatish
npm install

# 3) Backend .env ni sozlash
cp boyxon/server/.env.example boyxon/server/.env
# .env ichidagi kalitlarni to'ldiring (JWT_SECRET, MONGODB_URI, ADMIN_PASSWORD)

# 4) Frontend .env ni sozlash
cp boyxon/client/.env.example boyxon/client/.env

# 5) Barcha xizmatlarni bir vaqtda ishga tushirish (client:5173, server:5000)
npm run dev
```

## 📱 Qaysi qismlar bor?

| Qism | Texnologiya | Manzil |
|------|-------------|--------|
| Frontend | React 18 + Vite + TS + Tailwind | `boyxon/client` |
| Backend | Express + TS + Mongoose + native WebSocket | `boyxon/server` |
| Mobil ilova | Flutter | `boyxon/mobile` |
| DB (lokal) | MongoDB (docker-compose) | `docker-compose.yml` |
| Deploy | Render Blueprint (bepul) | `render.yaml` |
| Rasmlar | Cloudflare Worker + KV (bepul) | `ops/media-worker` |

## 📄 Dokumentatsiya

- [README (boyxon/)](boyxon/README.md) — ishga tushirish, API, deploy, testlar
- [DEPLOYMENT.md](DEPLOYMENT.md) — **productionga chiqarish (100% bepul arxitektura)**
- [DESIGN.md](DESIGN.md) — dizayn tizimi (rang, shrift, ekranlar)
- [SECURITY.md](boyxon/SECURITY.md) — xavfsizlik choralari va deploy oldi tekshiruvlar
- [CONTRIBUTING.md](CONTRIBUTING.md) — hissa qo'shish qo'llanmasi

## 🧪 Testlar

```bash
cd boyxon/server
npm run test:unit   # 12 ta unit test (narx, ETA, chegirma)
npm test            # 76 ta e2e tekshiruv (auth, dishes, orders, admin, injection)
```

## 📜 Litsenziya

MIT — [LICENSE](LICENSE)