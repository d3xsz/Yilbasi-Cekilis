// Çekiliş mantığı: herkes tam olarak bir kişiye, kimse kendine düşmeyecek şekilde dağıtılır.
const crypto = require('crypto');

/**
 * Herkesi rastgele sıralayıp tek bir çember (döngü) halinde bağlar.
 * Sonuç: her kişi başka birine çıkar, kimse kendine çıkmaz,
 * her kişiye tam olarak bir kişi düşer (iki kişiye aynı isim gelmez).
 *
 * @param {string[]} ids katılımcı kimlikleri (en az 2)
 * @returns {Object<string,string>} veren -> alan eşleşmesi
 */
function cekilisYap(ids) {
  if (!Array.isArray(ids) || ids.length < 2) {
    throw new Error('Çekiliş için en az 2 katılımcı gerekli.');
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error('Katılımcı listesinde tekrar eden kayıt var.');
  }

  const sira = ids.slice();
  // Fisher–Yates: tamamen rastgele ve adil bir sıralama
  for (let i = sira.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1); // 0 <= j <= i
    [sira[i], sira[j]] = [sira[j], sira[i]];
  }

  // Sırayı bir çember gibi bağla: sira[0] -> sira[1] -> ... -> sira[n-1] -> sira[0]
  // Böylece kimse kendine çıkmaz ve herkes tam bir kişiye düşer.
  const eslesme = {};
  for (let i = 0; i < sira.length; i++) {
    eslesme[sira[i]] = sira[(i + 1) % sira.length];
  }

  dogrula(ids, eslesme); // emniyet kemeri
  return eslesme;
}

/** Eşleşmenin kurallara uyduğunu kontrol eder; uymuyorsa hata fırlatır. */
function dogrula(ids, eslesme) {
  const alanlar = new Set();
  for (const id of ids) {
    const hedef = eslesme[id];
    if (hedef === undefined) throw new Error(`${id} için eşleşme yok.`);
    if (hedef === id) throw new Error(`${id} kendine çıktı.`);
    if (!ids.includes(hedef)) throw new Error(`${hedef} katılımcı değil.`);
    if (alanlar.has(hedef)) throw new Error(`${hedef} iki kişiye çıktı.`);
    alanlar.add(hedef);
  }
  if (Object.keys(eslesme).length !== ids.length) throw new Error('Fazla eşleşme var.');
  return true;
}

module.exports = { cekilisYap, dogrula };
