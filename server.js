// server.js
// Backend minimal untuk game Momon.
//
// Endpoint:
//   GET  /api/balance?wallet=<address>
//   POST /api/earn      { wallet, amount, reason }   header: x-earn-secret
//   POST /api/withdraw  { wallet, amount }
//
// Jalankan lokal:
//   cp .env.example .env   (lalu isi nilainya)
//   npm install
//   npm start

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PublicKey } = require('@solana/web3.js');

const storage = require('./storage');
const treasury = require('./treasury');

const app = express();
app.use(express.json());

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: ALLOWED_ORIGIN }));

const EARN_SECRET = process.env.EARN_SECRET;
const MIN_WITHDRAW = Number(process.env.MIN_WITHDRAW || 50000);
// Batas atas per satu panggilan /api/earn, jaga-jaga dari salah pakai/abuse.
const MAX_EARN_PER_CALL = Number(process.env.MAX_EARN_PER_CALL || 1000);

function isValidWallet(address) {
  try {
    new PublicKey(address);
    return true;
  } catch (e) {
    return false;
  }
}

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'momon-backend' });
});

// ---------------------------------------------------------------------
// GET /api/balance?wallet=...
// ---------------------------------------------------------------------
app.get('/api/balance', (req, res) => {
  const wallet = req.query.wallet;
  if (!wallet || !isValidWallet(wallet)) {
    return res.status(400).json({ error: 'wallet tidak valid' });
  }
  res.json({ balance: storage.getBalance(wallet) });
});

// ---------------------------------------------------------------------
// POST /api/earn   { wallet, amount, reason }
//
// PENTING soal keamanan: EARN_SECRET di sini cuma pagar minimal (mencegah
// orang random menembak endpoint ini asal-asalan). Karena secret ini pada
// akhirnya ada di kode frontend yang bisa dibaca lewat DevTools, ini BUKAN
// perlindungan penuh dari pemain yang niat curang memanggil endpoint ini
// langsung dengan angka besar. Untuk produksi/uang sungguhan, ganti dengan
// verifikasi tanda tangan wallet pemain (nacl/tweetnacl) atau validasi aksi
// di server (misalnya game state tersimpan & divalidasi di server, bukan
// cuma dipercaya dari klien).
// ---------------------------------------------------------------------
app.post('/api/earn', (req, res) => {
  if (EARN_SECRET) {
    const provided = req.get('x-earn-secret');
    if (provided !== EARN_SECRET) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }
  const { wallet, amount, reason } = req.body || {};
  if (!wallet || !isValidWallet(wallet)) {
    return res.status(400).json({ error: 'wallet tidak valid' });
  }
  const amt = Number(amount);
  if (!amt || amt <= 0 || amt > MAX_EARN_PER_CALL) {
    return res.status(400).json({ error: `amount harus 0 < amount <= ${MAX_EARN_PER_CALL}` });
  }
  const newBalance = storage.addBalance(wallet, amt);
  console.log(`[earn] ${wallet} +${amt} (${reason || 'tanpa alasan'}) -> saldo ${newBalance}`);
  res.json({ balance: newBalance });
});

// ---------------------------------------------------------------------
// POST /api/withdraw   { wallet, amount }
// ---------------------------------------------------------------------
app.post('/api/withdraw', async (req, res) => {
  const { wallet, amount } = req.body || {};
  if (!wallet || !isValidWallet(wallet)) {
    return res.status(400).json({ error: 'wallet tidak valid' });
  }
  const amt = Number(amount);
  if (!amt || amt < MIN_WITHDRAW) {
    return res.status(400).json({ error: `jumlah withdrawal minimum ${MIN_WITHDRAW}` });
  }

  // Kunci saldo dulu (kurangi) SEBELUM kirim transaksi on-chain, supaya
  // request withdraw ganda/tumpang-tindih tidak bisa mencairkan lebih dari
  // saldo yang sebenarnya dimiliki pemain.
  const sub = storage.trySubtractBalance(wallet, amt);
  if (!sub.ok) {
    return res.status(400).json({ error: 'saldo tidak cukup' });
  }

  try {
    const signature = await treasury.sendPisangFromTreasury(wallet, amt);
    console.log(`[withdraw] ${wallet} -${amt} -> tx ${signature}`);
    res.json({ ok: true, signature, balance: sub.balance });
  } catch (e) {
    // Transaksi on-chain gagal — kembalikan saldo yang tadi sudah dikurangi.
    storage.addBalance(wallet, amt);
    console.error('[withdraw] gagal:', e);
    res.status(500).json({ ok: false, error: 'Transaksi on-chain gagal: ' + e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`momon-backend jalan di port ${PORT}`);
  console.log(`Treasury wallet: ${treasury.getTreasuryAddress()}`);
});
