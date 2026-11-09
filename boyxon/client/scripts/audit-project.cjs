const fs = require('fs');
const path = require('path');

const clientSrc = path.join(__dirname, '..', 'src');
const localesDir = path.join(clientSrc, 'locales');

const uz = JSON.parse(fs.readFileSync(path.join(localesDir, 'uz.json'), 'utf8'));
const ru = JSON.parse(fs.readFileSync(path.join(localesDir, 'ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));

const uzKeys = new Set(Object.keys(uz));
const ruKeys = new Set(Object.keys(ru));
const enKeys = new Set(Object.keys(en));

console.log('=== I18N STATS ===');
console.log('uz keys:', uzKeys.size);
console.log('ru keys:', ruKeys.size);
console.log('en keys:', enKeys.size);

const missingInRu = [...uzKeys].filter(k => !ruKeys.has(k));
const missingInEn = [...uzKeys].filter(k => !enKeys.has(k));
const missingInUz = [...ruKeys].filter(k => !uzKeys.has(k));

console.log('Missing in ru:', missingInRu);
console.log('Missing in en:', missingInEn);
console.log('Missing in uz:', missingInUz);

function walk(dir) {
  let res = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) res = res.concat(walk(full));
    else if (/\.(tsx|ts)$/.test(f)) res.push(full);
  }
  return res;
}

const files = walk(clientSrc);
const missingKeysUsed = new Set();
const tRegex = /t\(['"]([a-zA-Z0-9_.-]+)['"]/g;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = tRegex.exec(content)) !== null) {
    const key = match[1];
    if (!uzKeys.has(key)) {
      missingKeysUsed.add(`${key} (in ${path.relative(clientSrc, file)})`);
    }
  }
}

console.log('\n=== MISSING KEYS USED IN CODE ===');
for (const m of missingKeysUsed) {
  console.log('-', m);
}
