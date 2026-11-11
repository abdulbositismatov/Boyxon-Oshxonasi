# 🤝 Hissa qo'shish — Boyxon Oshxonasi

Salom! Boyxon Oshxonasi loyihasiga qiziqishingiz uchun rahmat. Quyidagi qo'llanma sizga tez va qulay hissa qo'shishga yordam beradi.

## Qaysi qismlarga hissa qo'shish mumkin?

| Bo'lim | Qanday hissa qo'shish mumkin |
|--------|------------------------------|
| **Frontend** | Yangi sahifalar, komponentlar, i18n tarjimalar, SEO |
| **Backend** | Yangi API endpointlari, modellari, validatsiya, xavfsizlik |
| **Mobile (Flutter)** | Yangi ekranlar, push bildirishnomalar, xarita, to'lov |
| **Dokumentatsiya** | README, DESIGN.md, SECURITY.md, API hujjatlari |
| **Testlar** | E2E, bir boshqarish, integratsion testlar |

## Boshlash (ishlab chiqarish)

```bash
# 1) Reponi klonlash
git clone https://github.com/mansurvv710/Boyxon-Oshxonasi.git
cd Boyxon-Oshxonasi

# 2) Barcha bog'liqliklarni o'rnatish (root'dan)
npm install

# 3) Backend .env ni sozlash
cp boyxon/server/.env.example boyxon/server/.env
# .env ichidagi JWT_SECRET, MONGODB_URI, ADMIN_PASSWORD hamkasini to'ldiring

# 4) Frontend .env ni sozlash
cp boyxon/client/.env.example boyxon/client/.env

# 5) Lokal MongoDB (docker) yoki dev:local bilan ishga tushirish
docker compose up -d
# yoki
npm run dev:server   # xotirada MongoDB + demo ma'lumotlar

# 6) Barcha xizmatlarni bir vaqtda ishga tushirish
npm run dev          # client (5173) + server (5000)
```

## Hissa qo'shish oqimi (PR)

1. **Fork qiling** va yangi branch yarating:
   ```bash
   git checkout -b feature/ismingiz-umumiy-nom
   ```

2. **O'zgarishlarni kiriting** va testdan o'tkazing:
   ```bash
   npm run lint      # TypeScript xatolarini tekshirish
   npm run test      # Server testlari (63 ta tekshiruv)
   ```

3. **Commit yozing** (qisqa va anglatkali):
   ```
   feat: savatga promo kod qo'shish
   fix: admin panelda buyurtma statusini yangilash
   docs: README'da deploy qo'llanmasini to'ldirish
   ```

4. **Pull Request oching** — tavsifini to'ldirishingiz va "Ready for review" deb belgilang.

## Kod uslubi

- **TypeScript**: `strict` mode, `any` dan qoching, interfeyslar orqali typing
- **React**: funksional komponentlar, hooks, shadcn/UI primitive'laridan foydalaning
- **Tailwind**: `globals.css` ichidagi CSS o'zgaruvchilar (tokens) + `tailwind.config.ts` dan tokenlar
- **i18n**: yangi matnni `uz.json`, `ru.json`, `en.json` ga bir xil kalit bilan qo'shing
- **Commitlar**: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`)

## Xavfsizlik

Maxfiy kalitlar (`.env`, `vapid-keys.json`, `JWT_SECRET` va hokazo) **HECH QACHON** commit qilinmasin. Agar xavfsizlik xatolikini topgan bo'lsangiz — oddiy issue ochmasdan, [SECURITY.md](./SECURITY.md) bo'yicha aloqaga chiqing.

## Loyiha tuzilmasi

```
boyxon-oshxonasi/                 # repo ildizi
├── package.json                  # root skriptlar (client + server birga)
├── docker-compose.yml            # lokal MongoDB
├── render.yaml                   # Render deploy blueprint
├── .github/workflows/            # CI/CD + keep-alive
├── boyxon/
│   ├── client/                   # React + Vite + TS + Tailwind
│   ├── server/                   # Express + TS + Mongoose + Socket.IO
│   └── mobile/                   # Flutter ilova
├── README.md                     # asosiy qo'llanma
├── DESIGN.md                     # dizayn tizimi (rang, shrift, ekranlar)
├── SECURITY.md                   # xavfsizlik choralari
└── CONTRIBUTING.md               # shu fayl
```

## Mualliflar

- **Nematulloh** — loyiga biriktirilgan asosiy dasturchi ([@mansurvv710](https://github.com/mansurvv710))

Hissa qo'shgan har bir odamga minnatdormiz! 🙌