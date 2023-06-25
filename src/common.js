const { decodeAbiParameters } = require('viem');
const { toEtherscanTx, writeToFile } = require('./utils/utils');

const COMMON_ADDRESSES = require('./utils/common-addresses.json');

// @TODO: this needs to be abstracted/refactored away
const UniswapV2FactoryABI = require('./abis/UniswapV2Factory.json');

const OUTPUT_TXS = './output/block-tx';
const OUTPUT_EVENTS = './output/block-events';

function isTxContractDeployment(transaction) {
  if (transaction.create || !transaction.to) {
    console.log(toEtherscanTx(transaction.hash));
  }
}

function isTxFromTrackedAddress(transaction) {
  // @TODO make dynamic
  const trackedAddresss = ['0x7431931094e8bae1ecaa7d0b57d2284e121f760e'];

  // tracked wallet moved
  if (trackedAddresss.includes(transaction.from)) {
    console.log(`${transaction.from}: ${toEtherscanTx(transaction.hash)}`);
  }
}

function isEventNotable(log) {
  // @TODO: make generic
  // if (Object.keys(COMMON_ADDRESSES).includes(log.address)) {
  //   console.log(log);
  // }

  // @TODO: hardcoded
  if (COMMON_ADDRESSES[log.address]?.name === 'UniswapV2Factory') {
    console.log(log);
  }
}

async function uniswapV2PairCreated(events) {
  // if event = PairCreated, report tokens
  // also report the Mint event
}

async function analyzeBlock({ client, blockNumber, outputToFile }) {
  const block = await client.getBlock({ blockNumber });

  const promises = [];

  for (const transactionHash of block.transactions) {
    promises.push(client.getTransaction({ hash: transactionHash }));
  }

  const transactions = await Promise.all(promises);

  if (outputToFile) await writeToFile(`${OUTPUT_TXS}-${blockNumber.toString()}.json`, transactions);

  for (const transaction of transactions) {
    isTxContractDeployment(transaction)
    isTxFromTrackedAddress(transaction);
  }

  // get events
  const events = await client.getLogs({ blockHash: block.hash });

  if (outputToFile) await writeToFile(`${OUTPUT_EVENTS}-${blockNumber.toString()}.json`, events);

  for (const event of events) {
    isEventNotable(event);
  }
}

module.exports = {
  analyzeBlock
};
