// Yılbaşı çekilişi sunucusu — harici paket gerektirmez. Çalıştır: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { cekilisYap } = require('./cekilis');

const PORT = Number(process.env.PORT) || 3000;
const VERI_DOSYASI = path.join(__dirname, 'veri.json');
const MIN_KATILIMCI = 3;
const MAX_KATILIMCI = 200;

// ---------- Veri ----------
// UPSTASH_REDIS_REST_URL ve UPSTASH_REDIS_REST_TOKEN tanımlıysa veri Upstash'te (internette) tutulur,
// tanımlı değilse bu klasördeki veri.json dosyasında.
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const UPSTASH_ANAHTAR = 'yilbasi-cekilis:veri';
const depo = UPSTASH_URL && UPSTASH_TOKEN ? 'upstash' : 'dosya';

async function upstash(komut) {
  const r = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(komut),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(`Upstash hatası: ${d.error || r.status}`);
  return d.result;
}

let veri = { odalar: {} };

async function yukle() {
  if (depo === 'upstash') {
    const ham = await upstash(['GET', UPSTASH_ANAHTAR]);
    if (ham) veri = JSON.parse(ham);
  } else {
    try { veri = JSON.parse(fs.readFileSync(VERI_DOSYASI, 'utf8')); } catch { /* ilk çalıştırma */ }
  }
  veri.odalar ||= {};
}

// Yazmalar sırayla yapılır; aynı anda katılan iki kişinin kaydı birbirini ezmez.
let yazmaKuyrugu = Promise.resolve();
function kaydet() {
  const icerik = JSON.stringify(veri);
  const is = yazmaKuyrugu.then(async () => {
    if (depo === 'upstash') {
      await upstash(['SET', UPSTASH_ANAHTAR, icerik]);
    } else {
      const gecici = VERI_DOSYASI + '.tmp';
      fs.writeFileSync(gecici, icerik);
      fs.renameSync(gecici, VERI_DOSYASI);
    }
  });
  yazmaKuyrugu = is.catch(() => {});
  return is;
}

const anahtar = () => crypto.randomBytes(16).toString('hex');
function odaKodu() {
  const harfler = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışan karakterler yok
  let kod;
  do {
    kod = Array.from({ length: 6 }, () => harfler[crypto.randomInt(harfler.length)]).join('');
  } while (veri.odalar[kod]);
  return kod;
}
const temizIsim = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const normal = (s) => temizIsim(s).toLocaleLowerCase('tr-TR');
const esit = (a, b) =>
  typeof a === 'string' && typeof b === 'string' && a.length === b.length &&
  crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function odaOzeti(oda) {
  return {
    kod: oda.kod,
    ad: oda.ad,
    cekildi: oda.cekildi,
    katilimcilar: oda.katilimcilar.map((k) => ({ id: k.id, isim: k.isim, acti: k.acildi || null })),
  };
}

// ---------- HTTP yardımcıları ----------
function json(res, durum, govde) {
  res.writeHead(durum, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(govde));
}
const hata = (res, durum, mesaj) => json(res, durum, { hata: mesaj });

function govdeOku(req) {
  return new Promise((coz, reddet) => {
    let d = '';
    req.on('data', (p) => {
      d += p;
      if (d.length > 10_000) { reddet(new Error('Çok büyük istek')); req.destroy(); }
    });
    req.on('end', () => {
      try { coz(d ? JSON.parse(d) : {}); } catch { reddet(new Error('Geçersiz JSON')); }
    });
  });
}

// ---------- API ----------
async function api(req, res, parcalar, url) {
  // POST /api/odalar  {ad}
  if (req.method === 'POST' && parcalar.length === 1 && parcalar[0] === 'odalar') {
    const b = await govdeOku(req);
    const ad = temizIsim(b.ad).slice(0, 60) || 'Yılbaşı Çekilişi';
    const oda = { kod: odaKodu(), ad, yoneticiAnahtari: anahtar(), cekildi: false, katilimcilar: [], olusturma: Date.now() };
    veri.odalar[oda.kod] = oda;
    await kaydet();
    return json(res, 201, { ...odaOzeti(oda), yoneticiAnahtari: oda.yoneticiAnahtari });
  }

  if (parcalar[0] !== 'odalar' || !parcalar[1]) return hata(res, 404, 'Bulunamadı');
  const oda = veri.odalar[String(parcalar[1]).toUpperCase()];
  if (!oda) return hata(res, 404, 'Böyle bir çekiliş odası yok.');
  const islem = parcalar[2];

  // GET /api/odalar/:kod
  if (req.method === 'GET' && !islem) return json(res, 200, odaOzeti(oda));

  // GET /api/odalar/:kod/ben?token=...
  if (req.method === 'GET' && islem === 'ben') {
    const token = url.searchParams.get('token') || '';
    const ben = oda.katilimcilar.find((k) => esit(k.token, token));
    if (!ben) return hata(res, 404, 'Katılımcı bulunamadı.');
    const hedef = oda.cekildi ? oda.katilimcilar.find((k) => k.id === oda.eslesme[ben.id]) : null;
    return json(res, 200, { id: ben.id, isim: ben.isim, cekildi: oda.cekildi, hedef: hedef ? hedef.isim : null, acti: ben.acildi || null });
  }

  if (req.method !== 'POST') return hata(res, 405, 'Desteklenmeyen istek');
  const b = await govdeOku(req);
  const yonetici = () => esit(oda.yoneticiAnahtari, String(b.yoneticiAnahtari || ''));

  // POST /api/odalar/:kod/ac  {token} — katılımcı sandığını açtı (kime çıktığı paylaşılmaz)
  if (islem === 'ac') {
    if (!oda.cekildi) return hata(res, 409, 'Çekiliş henüz yapılmadı.');
    const ben = oda.katilimcilar.find((k) => esit(k.token, String(b.token || '')));
    if (!ben) return hata(res, 404, 'Katılımcı bulunamadı.');
    if (!ben.acildi) { ben.acildi = Date.now(); await kaydet(); }
    return json(res, 200, { acti: ben.acildi });
  }

  // POST /api/odalar/:kod/katil  {isim}
  if (islem === 'katil') {
    if (oda.cekildi) return hata(res, 409, 'Çekiliş yapıldı, artık katılım kapalı.');
    const isim = temizIsim(b.isim);
    if (isim.length < 2) return hata(res, 400, 'İsim en az 2 karakter olmalı.');
    if (isim.length > 40) return hata(res, 400, 'İsim en fazla 40 karakter olabilir.');
    if (oda.katilimcilar.some((k) => normal(k.isim) === normal(isim)))
      return hata(res, 409, 'Bu isim zaten kayıtlı. Farklı bir isim yaz (ör. soyadının baş harfini ekle).');
    if (oda.katilimcilar.length >= MAX_KATILIMCI) return hata(res, 409, 'Katılımcı sınırına ulaşıldı.');
    const k = { id: anahtar().slice(0, 12), isim, token: anahtar() };
    oda.katilimcilar.push(k);
    try { await kaydet(); } catch (e) {
      oda.katilimcilar = oda.katilimcilar.filter((x) => x !== k); // kaydedilemediyse geri al
      throw e;
    }
    return json(res, 201, { id: k.id, isim: k.isim, token: k.token });
  }

  // POST /api/odalar/:kod/cikar  {yoneticiAnahtari, id}
  if (islem === 'cikar') {
    if (!yonetici()) return hata(res, 403, 'Yetkin yok.');
    if (oda.cekildi) return hata(res, 409, 'Çekiliş yapıldıktan sonra kimse çıkarılamaz.');
    const once = oda.katilimcilar.length;
    oda.katilimcilar = oda.katilimcilar.filter((k) => k.id !== b.id);
    if (oda.katilimcilar.length === once) return hata(res, 404, 'Katılımcı bulunamadı.');
    await kaydet();
    return json(res, 200, odaOzeti(oda));
  }

  // POST /api/odalar/:kod/cek  {yoneticiAnahtari}
  if (islem === 'cek') {
    if (!yonetici()) return hata(res, 403, 'Yetkin yok.');
    if (oda.cekildi) return hata(res, 409, 'Çekiliş zaten yapıldı.');
    if (oda.katilimcilar.length < MIN_KATILIMCI)
      return hata(res, 400, `Çekiliş için en az ${MIN_KATILIMCI} katılımcı gerekli.`);
    oda.eslesme = cekilisYap(oda.katilimcilar.map((k) => k.id));
    oda.cekildi = true;
    oda.cekilisZamani = Date.now();
    try { await kaydet(); } catch (e) {
      oda.cekildi = false; delete oda.eslesme; delete oda.cekilisZamani; // geri al
      throw e;
    }
    return json(res, 200, odaOzeti(oda));
  }

  return hata(res, 404, 'Bulunamadı');
}

// ---------- Sunucu ----------
const sunucu = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) {
      const parcalar = url.pathname.slice(5).split('/').filter(Boolean).map(decodeURIComponent);
      return await api(req, res, parcalar, url);
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
    }
    hata(res, 404, 'Bulunamadı');
  } catch (e) {
    console.error(e);
    const kayitHatasi = String(e.message).startsWith('Upstash');
    if (!res.headersSent)
      hata(res, kayitHatasi ? 503 : 400, kayitHatasi ? 'Kayıt şu an yapılamadı, birazdan tekrar dene.' : e.message || 'Hata');
  }
});

yukle().then(() => sunucu.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎄 Yılbaşı çekilişi çalışıyor (veri: ${depo === 'upstash' ? 'Upstash' : 'veri.json'}):`);
  console.log(`   Bu bilgisayar : http://localhost:${PORT}`);
  for (const arayuzler of Object.values(os.networkInterfaces())) {
    for (const a of arayuzler || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`   Aynı ağdakiler: http://${a.address}:${PORT}`);
    }
  }
  console.log('');
})).catch((e) => {
  console.error('Veri yüklenemedi, sunucu başlatılmadı:', e.message);
  process.exit(1);
});
