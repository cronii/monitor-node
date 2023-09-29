const fs = require('fs');
const fetch = require('node-fetch');
const COMMON_TOKENS = require('./common-tokens.json');
const CONFIG = require('../../config.json');
const ERC20ABI = require('../abis/erc20.read.json');

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

  const insertNewWalletTagQuery = 'INSERT OR IGNORE INTO wallet_tags (address, tag, type) VALUES (?, ?, ?)';
  await db.run(insertNewWalletTagQuery, [address, tag, type]);
}

async function tagWallets(db, addresses, tag, type, allowDupe = false) {
  const changes = { newWallets: 0, newWalletTags: 0 };

  for (const address of addresses) {
    const insertNewWalletQuery = 'INSERT OR IGNORE INTO wallets (address) VALUES (?)';
    const { changes: newWalletChange } = await db.run(insertNewWalletQuery, [address]);
    changes.newWallets += newWalletChange;

    if (!allowDupe) {
      const checkQuery = 'SELECT COUNT(*) AS count FROM wallet_tags WHERE address = ? and tag = ?';
      const { count } = await db.get(checkQuery, [address, tag]);
      if (count > 0) continue;
    }

    const insertNewWalletTagQuery = 'INSERT OR IGNORE INTO wallet_tags (address, tag, type) VALUES (?, ?, ?)';
    const { changes: newWalletTagChange } = await db.run(insertNewWalletTagQuery, [address, tag, type]);
    changes.newWalletTags += newWalletTagChange;
  }

  return changes;
}

async function getContractCreationData(address) {
  const apiCall = `https://api.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${CONFIG.etherscanApiKey}`;

  const response = await fetch(apiCall);
  const data = await response.json();

  return data.result[0];
}

async function toToken(client, address) {
  if (isCommonToken(address)) return isCommonToken(address);

  const erc20Contract = {
    address,
    abi: ERC20ABI
  };

  const results = await client.multicall({
    contracts: [
      {
        ...erc20Contract,
        functionName: 'symbol'
      },
      {
        ...erc20Contract,
        functionName: 'decimals'
      }
    ]
  });

  // @TODO currently there is an issue with reading certain symbols (ie. MKR 0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2)
  // likely due to non-compliant ERC20 definitions
  if (results.some(result => result.status === 'failure')) throw new Error(`Failed ERC20 Read ${address}`, { details: address });

  return {
    address,
    symbol: results[0].result,
    decimals: results[1].result
  }
}

async function honeypotIsRequest(address, pair, chain = 1) {
  const apiCall = `https://api.honeypot.is/v2/IsHoneypot?address=${address}&pair=${pair}&chainID=${chain}`;

  const response = await fetch(apiCall);
  const data = await response.json();

  return data;
}

// convert objects with bigint to string
function replacer(key, value) {
  if (typeof value === 'bigint') {
    return value.toString() + 'n';
  }
  return value;
}

function truncateDecimal(numberString, decimalPlaces = 4) {
  // Parse the number string into a floating-point number
  const number = parseFloat(numberString);

  // Check if the parsed number is a valid finite number
  if (!isFinite(number)) {
    throw new Error('Input is not a valid number');
  }

  // Use toFixed to round and format the number to the specified decimal places
  const truncatedNumber = number.toFixed(decimalPlaces);

  return truncatedNumber;
}

module.exports = {
  isCommonToken,
  isWETH,
  toDexscreenerEth,
  toEtherscanAddress,
  toEtherscanTx,
  writeToFile,
  nameWallet,
  tagWallet,
  tagWallets,
  getContractCreationData,
  toToken,
  honeypotIsRequest,
  truncateDecimal
}
