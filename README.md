# Momon Backend (minimal)

Backend kecil yang:
1. Menyimpan saldo $PISANG hasil gameplay per wallet (`/api/earn`, `/api/balance`)
2. Memproses withdrawal dengan mengirim $PISANG asli dari **treasury wallet** ke wallet pemain (`/api/withdraw`)

## Jalankan lokal

```bash
npm install
cp .env.example .env
# edit .env, isi TREASURY_SECRET_KEY dan EARN_SECRET
npm start
```

## Menyiapkan treasury wallet

1. Buat wallet Solana **baru, khusus untuk ini** (jangan pakai wallet pribadi) — bisa lewat Phantom, atau `solana-keygen new`.
2. Isi wallet itu dengan token $PISANG secukupnya untuk dibagikan ke pemain (beli/transfer dari wallet lain), dan sedikit SOL untuk biaya transaksi (rent + fee, sisakan minimal ~0.05 SOL untuk jaga-jaga).
3. Ambil private key-nya:
   - Phantom: Settings → Security & Privacy → Export Private Key (hasilnya base58) — cocok langsung untuk `TREASURY_SECRET_KEY`.
   - Solana CLI: file keypair `.json` isinya array angka — bisa langsung ditempel ke `TREASURY_SECRET_KEY`.
4. **Jangan pernah** taruh private key ini di kode frontend atau commit ke git.

## Deploy gratis (contoh: Render.com)

1. Push folder ini ke repo GitHub.
2. Di Render.com → New → Web Service → hubungkan repo.
3. Build command: `npm install`, Start command: `npm start`.
4. Di tab **Environment**, isi semua variabel dari `.env.example` (terutama `TREASURY_SECRET_KEY`, `EARN_SECRET`, `ALLOWED_ORIGIN` = domain tempat kamu host `index.html`).
5. Deploy. Render kasih kamu URL seperti `https://momon-backend.onrender.com` — itu yang dipakai untuk `API_BASE` di `index.html`.

Platform gratis lain yang juga bisa: Railway, Fly.io. Prinsipnya sama: isi environment variable, jangan expose `.env`.

## Batasan versi minimal ini (untuk ditingkatkan nanti)

- **Penyimpanan saldo pakai file JSON lokal** (`storage.js`) — cukup untuk mulai, tapi disk di banyak hosting gratis bisa reset saat redeploy/restart. Untuk data yang harus awet, pindahkan ke database sungguhan (Postgres/Supabase/MongoDB Atlas, semua ada tier gratis).
- **`/api/earn` hanya dilindungi secret sederhana**, bukan verifikasi kriptografis. Karena secret ini ikut ter-bundle di kode frontend, pemain yang niat curang secara teknis masih bisa memanggil endpoint ini langsung. Untuk versi produksi/nilai uang sungguhan, tambahkan verifikasi tanda tangan wallet pemain (`tweetnacl`) atau pindahkan logika penentuan reward sepenuhnya ke server.
- Tidak ada rate limiting — pertimbangkan `express-rate-limit` sebelum live ke publik.
