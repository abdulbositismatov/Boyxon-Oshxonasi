/**
 * Render build yordamchisi.
 *
 * Frontend endi backend bilan bitta servisdan beriladi, shuning uchun
 * `boyxon/client/dist` build paytida mavjud bo'lishi shart. `render.yaml`
 * buildCommand'ni yangilaydi, lekin eski blueprint sozlamasi qolib ketgan
 * bo'lsa ham deploy ishlashi uchun bu skript dist yo'q bo'lsa client'ni
 * o'zi build qiladi.
 */
const { existsSync } = require('node:fs');
const { execSync } = require('node:child_process');
const path = require('node:path');

const clientDir = path.resolve(__dirname, '../../client');
const indexHtml = path.join(clientDir, 'dist', 'index.html');

if (existsSync(indexHtml)) {
  console.log('[build] client dist mavjud — qayta build qilinmaydi');
  process.exit(0);
}

console.log('[build] client dist topilmadi — client build qilinadi');
execSync('npm install', { cwd: clientDir, stdio: 'inherit' });
execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });
