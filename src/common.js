const fs = require('fs');

const OUTPUT_TX = './output/block-tx';
const OUTPUT_LOGS = './output/block-logs';

const COMMON_ADDRESSES = require('./utils/common-addresses.json');

function isTxContractDeployment(transaction) {
  if (transaction.create || !transaction.to) {
    console.log(`https://etherscan.io/tx/${transaction.hash}`);
  }
}

function isTxFromTrackedAddress(transaction) {
  const trackedAddresss = ['0x7431931094e8bae1ecaa7d0b57d2284e121f760e'];

  // tracked wallet moved
  if (trackedAddresss.includes(transaction.from)) {
    console.log(`${transaction.from}: https://etherscan.io/tx/${transaction.hash}`);
  }
}

function isLogNotable(log) {
  if (Object.keys(COMMON_ADDRESSES).includes(log.address)) {
    console.log(log);
  }
}

async function analyzeBlock({ client, blockNumber, output }) {
  const block = await client.getBlock({ blockNumber });

  const promises = [];

  for (const transactionHash of block.transactions) {
    promises.push(client.getTransaction({ hash: transactionHash }));
  }

  const transactions = await Promise.all(promises);

  if (output) {
    await fs.promises.writeFile(`${OUTPUT_TX}-${blockNumber.toString()}.json`, JSON.stringify(transactions, replacer, 2));
  }

  for (const transaction of transactions) {
    isTxContractDeployment(transaction)
    isTxFromTrackedAddress(transaction);
  }

  // get events
  const logs = await client.getLogs({ blockHash: block.hash });

  if (output) {
    await fs.promises.writeFile(`${OUTPUT_LOGS}-${blockNumber.toString()}.json`, JSON.stringify(logs, replacer, 2));
  }

  for (const log of logs) {
    isLogNotable(log);
  }
}

// convert objects with bigint to string
function replacer(key, value) {
  if (typeof value === 'bigint') {
    return value.toString() + 'n';
  }
  return value;
}

module.exports = {
  analyzeBlock
};
