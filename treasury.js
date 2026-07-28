// treasury.js
// Menangani koneksi Solana & pengiriman SPL token $PISANG dari treasury
// wallet ke wallet pemain saat withdrawal.

const {
  Connection,
  Keypair,
  PublicKey,
} = require('@solana/web3.js');
const {
  getOrCreateAssociatedTokenAccount,
  getMint,
  transferChecked,
} = require('@solana/spl-token');
const bs58 = require('bs58');

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const MINT_ADDRESS = process.env.MINT_ADDRESS; // wajib diisi di .env

if (!MINT_ADDRESS) {
  throw new Error('MINT_ADDRESS belum diisi di .env');
}
if (!process.env.TREASURY_SECRET_KEY) {
  throw new Error('TREASURY_SECRET_KEY belum diisi di .env');
}

const connection = new Connection(RPC_ENDPOINT, 'confirmed');
const mintPubkey = new PublicKey(MINT_ADDRESS);

// TREASURY_SECRET_KEY didukung 2 format:
//  - base58 string (format yang biasa diekspor Phantom: "Export Private Key")
//  - JSON array angka, mis. "[12,34,...]" (format file keypair Solana CLI)
function loadTreasuryKeypair() {
  const raw = process.env.TREASURY_SECRET_KEY.trim();
  try {
    if (raw.startsWith('[')) {
      const arr = JSON.parse(raw);
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch (e) {
    throw new Error('TREASURY_SECRET_KEY tidak valid: ' + e.message);
  }
}

const treasuryKeypair = loadTreasuryKeypair();

let decimalsCache = null;
async function getDecimals() {
  if (decimalsCache != null) return decimalsCache;
  const info = await getMint(connection, mintPubkey);
  decimalsCache = info.decimals;
  return decimalsCache;
}

// Kirim `amount` token $PISANG (dalam satuan token, bukan raw/lamport) dari
// treasury ke wallet tujuan. Membuat associated token account tujuan kalau
// belum ada. Mengembalikan signature transaksi.
async function sendPisangFromTreasury(toWalletAddress, amount) {
  const decimals = await getDecimals();
  const toPubkey = new PublicKey(toWalletAddress);

  const treasuryAta = await getOrCreateAssociatedTokenAccount(
    connection,
    treasuryKeypair, // payer biaya jaringan & rent
    mintPubkey,
    treasuryKeypair.publicKey
  );

  const destAta = await getOrCreateAssociatedTokenAccount(
    connection,
    treasuryKeypair, // treasury yang bayar biaya pembuatan ATA tujuan
    mintPubkey,
    toPubkey
  );

  const rawAmount = BigInt(Math.round(amount * 10 ** decimals));

  const signature = await transferChecked(
    connection,
    treasuryKeypair,
    treasuryAta.address,
    mintPubkey,
    destAta.address,
    treasuryKeypair,
    rawAmount,
    decimals
  );

  return signature;
}

function getTreasuryAddress() {
  return treasuryKeypair.publicKey.toBase58();
}

module.exports = { sendPisangFromTreasury, getTreasuryAddress };
