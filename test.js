// Çekiliş mantığı testi. Çalıştır: node test.js
const assert = require('assert');
const { cekilisYap, dogrula } = require('./cekilis');

let toplam = 0;
for (let n = 2; n <= 50; n++) {
  const ids = Array.from({ length: n }, (_, i) => 'k' + i);
  for (let t = 0; t < 2000; t++) {
    const e = cekilisYap(ids);
    dogrula(ids, e); // kendine çıkan yok, herkes bir kez alınıyor
    toplam++;
  }
}
console.log(`✓ ${toplam} çekilişte kural ihlali yok (2–50 kişi).`);

// Adalet: 4 kişide A'ya her diğer kişinin çıkma oranı ~1/3 olmalı
const say = { B: 0, C: 0, D: 0 };
const N = 60000;
for (let i = 0; i < N; i++) say[cekilisYap(['A', 'B', 'C', 'D']).A]++;
for (const [k, v] of Object.entries(say)) {
  const oran = v / N;
  assert(Math.abs(oran - 1 / 3) < 0.02, `${k} oranı dengesiz: ${oran}`);
}
console.log('✓ Dağılım dengeli:', Object.fromEntries(Object.entries(say).map(([k, v]) => [k, (v / N).toFixed(3)])));

// Hatalı girişler
assert.throws(() => cekilisYap(['A']));
assert.throws(() => cekilisYap(['A', 'A', 'B']));
assert.throws(() => dogrula(['A', 'B'], { A: 'A', B: 'B' }));
assert.throws(() => dogrula(['A', 'B', 'C'], { A: 'B', B: 'A', C: 'A' }));
console.log('✓ Hatalı girişler reddediliyor.');
