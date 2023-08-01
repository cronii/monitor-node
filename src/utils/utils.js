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
  writeToFile
}
