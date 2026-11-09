const fs = require('fs');
const path = require('path');
const locales = path.join(__dirname, '..', 'src', 'locales');

const uz = JSON.parse(fs.readFileSync(path.join(locales, 'uz.json'), 'utf8'));
const ru = JSON.parse(fs.readFileSync(path.join(locales, 'ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(locales, 'en.json'), 'utf8'));

uz['footer.download_app_soon'] = "Tez kunda Google Play va App Store'da chiqariladi";
ru['footer.download_app_soon'] = "Скоро появится в Google Play и App Store";
en['footer.download_app_soon'] = "Coming soon to Google Play and App Store";

fs.writeFileSync(path.join(locales, 'uz.json'), JSON.stringify(uz, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(locales, 'ru.json'), JSON.stringify(ru, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(locales, 'en.json'), JSON.stringify(en, null, 2) + '\n', 'utf8');

console.log('Done!');
