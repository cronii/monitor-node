const fs = require('fs');

const COMMON_TOKENS = require('./common-tokens.json');

function toEtherscanAddress(address) {
  return `https://etherscan.io/address/${address}`;
}

function toEtherscanTx(tx) {
  return `https://etherscan.io/tx/${tx}`;
}

function toDexscreenerEth(pair) {
  return `https://dexscreener.com/ethereum/${pair}`;
}

function isCommonToken(address) {
  return COMMON_TOKENS[address];
}

function isWETH(address) {
  return COMMON_TOKENS[address]?.symbol === 'WETH';
}

async function writeToFile(filename, object) {
  await fs.promises.writeFile(filename, JSON.stringify(object, replacer, 2));
}

async function nameWallet(db, address, name, tag) {
  const insertNewWalletQuery = 'INSERT OR IGNORE INTO wallets (address, name) VALUES (?, ?)';
  await db.run(insertNewWalletQuery, [address]);
}

async function tagWallet(db, address, tag, type, allowDupe = false) {
  const insertNewWalletQuery = 'INSERT OR IGNORE INTO wallets (address) VALUES (?)';
  await db.run(insertNewWalletQuery, [address]);

  if (!allowDupe) {
    const checkQuery = 'SELECT COUNT(*) AS count FROM wallet_tags WHERE address = ? and tag = ?';
    const { count } = await db.get(checkQuery, [address, tag]);
    if (count > 0) return;
  }

  const insertNewWalleetTagQuery = 'INSERT OR IGNORE INTO wallet_tags (address, tag, type) VALUES (?, ?, ?)';
  await db.run(insertNewWalleetTagQuery, [address, tag, type]);
}

// convert objects with bigint to string
function replacer(key, value) {
  if (typeof value === 'bigint') {
    return value.toString() + 'n';
  }
  return value;
}

module.exports = {
  isCommonToken,
  isWETH,
  toDexscreenerEth,
  toEtherscanAddress,
  toEtherscanTx,
  writeToFile,
  nameWallet,
  tagWallet
}
