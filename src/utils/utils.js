const fs = require('fs');

function toEtherscanAddress(address) {
  return `https://etherscan.io/address/${address}`;
}

function toEtherscanTx(tx) {
  return `https://etherscan.io/tx/${tx}`;
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
  toEtherscanAddress,
  toEtherscanTx,
  writeToFile
}
