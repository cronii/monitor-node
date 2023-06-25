const { decodeEventLog } = require('viem');
const { toEtherscanTx, writeToFile } = require('./utils/utils');

const COMMON_ADDRESSES = require('./utils/common-addresses.json');

const OUTPUT_TXS = './output/block-tx';
const OUTPUT_EVENTS = './output/block-events';

// @TODO: this needs to be abstracted/refactored away
const UniswapV2FactoryABI = require('./abis/UniswapV2Factory.json');
const UniswapV2PairABI = require('./abis/UniswapV2Pair.json');
const PAIR_CREATED_TOPIC = '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9';
const MINT_TOPIC = '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f'

async function analyzeBlock({ client, blockNumber, outputToFile }) {
  console.time(blockNumber.toString());
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

  // if a watched event is emitted, do through event analysis, otherwise skip
  if (hasWatchedEvent(events)) {
    await analyzeEvents(events);
  } else {
    console.log('no events found');
  }

  console.timeEnd(blockNumber.toString());
}

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

function getEventGroup(events, transactionIndex) {
  return events.filter(event => event.transactionIndex === transactionIndex);
}

function hasWatchedEvent(events) {
  // @TODO this is hardcoded
  return events.some(event => COMMON_ADDRESSES[event.address]?.name === 'UniswapV2Factory');
}

async function analyzeEvents(events) {
  for (const event of events) {
    // @TODO this is hardcoded
    if (COMMON_ADDRESSES[event.address]?.name === 'UniswapV2Factory') {
      const { topics, transactionIndex } = event;

      if (topics[0] === PAIR_CREATED_TOPIC) {
        const eventGroup = getEventGroup(events, transactionIndex);
        await uniswapV2PairCreated(eventGroup);
      }
    }
  }
}

async function uniswapV2PairCreated(eventGroup) {
  console.log('UniswapV2 PairCreated')

  // get pair tokens
  const encodedPairCreatedEvent = eventGroup.find(event => event.topics[0] === PAIR_CREATED_TOPIC);
  const pairCreatedEvent = decodeEventLog({
    abi: UniswapV2FactoryABI,
    data: encodedPairCreatedEvent.data,
    topics: encodedPairCreatedEvent.topics
  });

  // search for mint event, judge value based off of other pair
  const encodedMintEvent = eventGroup.find(event => event.topics[0] === MINT_TOPIC);
  const mintEvent = decodeEventLog({
    abi: UniswapV2PairABI,
    data: encodedMintEvent.data,
    topics: encodedMintEvent.topics
  });

  console.log(encodedPairCreatedEvent);
  console.log(pairCreatedEvent);
  console.log(encodedMintEvent);
  console.log(mintEvent);
}

module.exports = {
  analyzeBlock
};
