// storage.js
// Penyimpanan saldo $PISANG per wallet. Untuk MVP disimpan di file JSON lokal.
//
// CATATAN PENTING: di banyak hosting gratis (Render free web service, dsb),
// disk bisa direset saat container redeploy/restart/sleep. Ini cukup untuk
// mulai & testing, tapi begitu game punya banyak pemain dan uang sungguhan
// terlibat, pindahkan ke database sungguhan (Postgres/Supabase/MongoDB Atlas
// — semuanya ada tier gratis) supaya saldo pemain tidak pernah hilang.

const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'balances.json');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));

let balances = {};
try {
  balances = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch (e) {
  console.error('Gagal baca balances.json, mulai dari kosong:', e.message);
  balances = {};
}

function persist() {
  // Tulis sinkron: sederhana & cukup aman untuk skala kecil (menghindari
  // race condition antar request yang saling menimpa file).
  fs.writeFileSync(DB_FILE, JSON.stringify(balances, null, 2));
}

function getBalance(wallet) {
  return balances[wallet] || 0;
}

function addBalance(wallet, amount) {
  balances[wallet] = (balances[wallet] || 0) + amount;
  persist();
  return balances[wallet];
}

// Kurangi saldo hanya jika cukup — dipakai saat withdraw supaya tidak ada
// kondisi saldo minus akibat request yang tumpang tindih.
function trySubtractBalance(wallet, amount) {
  const current = balances[wallet] || 0;
  if (current < amount) return { ok: false, balance: current };
  balances[wallet] = current - amount;
  persist();
  return { ok: true, balance: balances[wallet] };
}

module.exports = { getBalance, addBalance, trySubtractBalance };
