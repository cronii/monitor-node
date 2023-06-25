const { decodeEventLog, formatUnits, trim } = require('viem');
const { isCommonToken, writeToFile } = require('./utils/utils');
const { reportError, reportTrackedWalletActivity, reportUniswapV2PairCreated } = require('./reporter');

const COMMON_ADDRESSES = require('./utils/common-addresses.json');

const OUTPUT_TXS = './output/block-tx';
const OUTPUT_EVENTS = './output/block-events';

const ERC20ABI = require('./abis/erc20.read.json');

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
    // isTxContractDeployment(transaction);
    isTxFromTrackedAddress(transaction);
  }

  // get events
  const events = await client.getLogs({ blockHash: block.hash });

  if (outputToFile) await writeToFile(`${OUTPUT_EVENTS}-${blockNumber.toString()}.json`, events);

  // if a watched event is emitted, do thorough event analysis, otherwise skip
  try {
    if (hasWatchedEvent(events)) await analyzeEvents(client, events);
  } catch (err) {
    console.log(`Event Listener Error: ${blockNumber.toString()}`);
    await reportError({ blockNumber })
  }

  console.timeEnd(blockNumber.toString());
}

// function isTxContractDeployment(transaction) {
//   if (transaction.create || !transaction.to) {
//     console.log(toEtherscanTx(transaction.hash));
//   }
// }

function isTxFromTrackedAddress(transaction) {
  const { from, hash } = transaction;
  // @TODO make dynamic
  const trackedAddresss = ['0x7431931094e8bae1ecaa7d0b57d2284e121f760e'];

  // tracked wallet moved
  if (trackedAddresss.includes(from)) {
    // console.log(`${transaction.from}: ${toEtherscanTx(transaction.hash)}`);
    reportTrackedWalletActivity(from, hash)
  }
}

function getEventGroup(events, transactionIndex) {
  return events.filter(event => event.transactionIndex === transactionIndex);
}

function hasWatchedEvent(events) {
  // @TODO this is hardcoded
  return events.some(event => COMMON_ADDRESSES[event.address]?.name === 'UniswapV2Factory');
}

// @TODO following event functions need to turned into a class or abstracted away
async function analyzeEvents(client, events) {
  for (const event of events) {
    // @TODO this is hardcoded
    if (COMMON_ADDRESSES[event.address]?.name === 'UniswapV2Factory') {
      const { topics, transactionIndex } = event;

      if (topics[0] === PAIR_CREATED_TOPIC) {
        const eventGroup = getEventGroup(events, transactionIndex);
        await uniswapV2PairCreated(client, eventGroup);
      }
    }
  }
}

async function uniswapV2PairCreated(client, eventGroup) {
  // get pair tokens
  const encodedPairCreatedEvent = eventGroup.find(event => event.topics[0] === PAIR_CREATED_TOPIC);
  const pairCreatedEvent = decodeEventLog({
    abi: UniswapV2FactoryABI,
    data: encodedPairCreatedEvent.data,
    topics: encodedPairCreatedEvent.topics
  });

  const tokenAddress0 = trim(encodedPairCreatedEvent.topics[1]);
  const tokenAddress1 = trim(encodedPairCreatedEvent.topics[2]);
  const token0 = await toToken(client, tokenAddress0);
  const token1 = await toToken(client, tokenAddress1);
  const pair = pairCreatedEvent.args[0];

  // search for mint event
  const encodedMintEvent = eventGroup.find(event => event.topics[0] === MINT_TOPIC);
  const mintEvent = decodeEventLog({
    abi: UniswapV2PairABI,
    data: encodedMintEvent.data,
    topics: encodedMintEvent.topics
  });

  // @PITFALL assuming token1 is common token (ie WETH)
  const { amount0, amount1 } = mintEvent.args;
  const supplied = formatUnits(amount0, token0.decimals);
  const value = formatUnits(amount1, token1.decimals);
  const totalSupply = formatUnits(token0.totalSupply, token0.decimals);

  await reportUniswapV2PairCreated({
    symbol0: token0.symbol,
    symbol1: token1.symbol,
    pair,
    value,
    supplied,
    totalSupply
  });
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
      },
      {
        ...erc20Contract,
        functionName: 'totalSupply'
      }
    ]
  });

  // @PITFALL we dont check for contract read failures
  return {
    symbol: results[0].result,
    decimals: results[1].result,
    totalSupply: results[2].result
  }
}

module.exports = {
  analyzeBlock
};
