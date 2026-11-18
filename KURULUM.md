# 🎄 Kim Kime? — Yılbaşı Çekilişi

## Kendi bilgisayarında çalıştırma
```
node server.js
```
Tarayıcıda `http://localhost:3000` adresini aç. Aynı Wi-Fi'dekiler, sunucunun ekrana yazdığı `http://192.168.x.x:3000` adresiyle girer.
Veri bu klasördeki `veri.json` dosyasında tutulur.

## İnternete açma (ücretsiz): Upstash + Render

### 1) Upstash (verinin saklandığı yer)
1. https://console.upstash.com adresinde ücretsiz hesap aç.
2. **Create Database** → Redis → bir isim ver → bölge olarak **Frankfurt (eu-central-1)** seç → Free plan → Create.
3. Veritabanı sayfasındaki **REST API** bölümünden şu iki değeri kopyala:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 2) Render (sitenin çalıştığı yer)
1. https://render.com adresinde **GitHub ile** ücretsiz hesap aç.
2. **New → Web Service** → bu projenin GitHub deposunu seç.
3. Ayarlar:
   - Region: **Frankfurt**
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Instance Type: **Free**
4. **Environment Variables** bölümüne Upstash'ten aldığın iki değeri aynı isimlerle ekle.
5. **Deploy** → birkaç dakika sonra `https://....onrender.com` adresin hazır olur. Bu linki herkesle paylaş.

### Bilmen gerekenler
- Ücretsiz Render sunucusu 15 dakika kimse girmezse uykuya geçer. Sonra ilk giren kişide sayfa **30–60 saniye** geç açılır, sonrası hızlıdır. Veri kaybolmaz (Upstash'te durur).
- Koddaki bir değişikliği GitHub'a gönderince Render siteyi kendiliğinden günceller.

## Test
```
node test.js
```
