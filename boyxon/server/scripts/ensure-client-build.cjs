/**
 * Render build yordamchisi.
 *
 * Frontend endi backend bilan bitta servisdan beriladi, shuning uchun
 * `boyxon/client/dist` build paytida mavjud bo'lishi shart. `render.yaml`
 * buildCommand'ni yangilaydi, lekin eski blueprint sozlamasi qolib ketgan
 * bo'lsa ham deploy ishlashi uchun bu skript dist yo'q bo'lsa client'ni
 * o'zi build qiladi.
 *
 * MUHIM: Render build paytida `NODE_ENV=production` qo'yadi. Bunday holatda
 * oddiy `npm install` devDependencies'ni (vite, typescript) o'tkazib yuboradi
 * va `tsc` "Cannot find type definition file for 'vite/client'" bilan yiqiladi.
 * Shuning uchun `--include=dev` majburiy.
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
execSync('npm install --include=dev --no-audit --no-fund', {
  cwd: clientDir,
  stdio: 'inherit',
});
execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });
