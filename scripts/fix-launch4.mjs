import fs from 'node:fs';
const p = 'scripts/launch.mjs';
let s = fs.readFileSync(p, 'utf8');
s = s.split('\u2014').join('-');
s = s.split('\uFFFD').join('');
s = s.replace(/Run \u505c\u6b62\u6e38\u620f\.bat to stop it\./, 'Run stop.bat (停止游戏.bat) to stop it.');
fs.writeFileSync(p, s, 'utf8');
const bad = [...s].filter((ch) => ch.charCodeAt(0) > 0x2fff && !/[\u4e00-\u9fff]/.test(ch));
console.log('odd chars:', bad.length);
