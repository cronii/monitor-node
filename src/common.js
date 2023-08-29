const { decodeEventLog, trim } = require('viem');
const { isWETH, toToken, honeypotIsRequest } = require('./utils');
const { reportError } = require('./reporter');

const COMMON_ADDRESSES = require('./utils/common-addresses.json');
const { UniswapV2FactoryABI, UniswapV2PairABI } = require('./abis');

const { PAIR_CREATED_TOPIC, ETH_CHAIN_ID, UNISWAP_V2_FACTORY, SWAP, MINT, BURN } = require('./utils/constants');
const WATCHED_EVENTS = [SWAP, MINT, BURN];

const { insertScreenerPairQuery, insertScreenerEventQuery, insertHoneypotIsResultsQuery } = require('./utils/queries');

async function analyzeBlock({ client, db, blockNumber }) {
  const blockNumberString = blockNumber.toString();
  console.time(blockNumberString);

  const block = await client.getBlock({ blockNumber });
  const events = await client.getLogs({ blockHash: block.hash });

  try {
    await analyzeEvents({ client, db, blockNumber: blockNumberString, events });
  } catch (err) {
    console.log(err);
    await reportError({ blockNumber: blockNumberString })
  }

  console.timeEnd(blockNumber.toString());
}

async function analyzeEvents({ client, db, blockNumber, events }) {
  const getWatchedPairsQuery = 'SELECT pairAddress, pair, flipTokens FROM watched_pairs';
  const watchedPairs = await db.all(getWatchedPairsQuery);
  const watchedPairAddresses = watchedPairs.map(pair => pair.pairAddress.toLowerCase());

  for (const event of events) {
    const { address, topics } = event;

    if (isUniswapV2PairCreated(address, topics)) {
      const newPair = await uniswapV2PairCreated({ client, db, blockNumber, event });
      if (newPair) {
        watchedPairs.push(newPair);
        watchedPairAddresses.push(newPair.pairAddress);
      }
    } else if (watchedPairAddresses.includes(address.toLowerCase())) {
      const pair = watchedPairs[watchedPairAddresses.indexOf(address.toLowerCase())];
      await watchedPairEvent({ client, db, pair, event });
    }
  }
}

function isUniswapV2PairCreated(address, topics) {
  return COMMON_ADDRESSES[address]?.name === UNISWAP_V2_FACTORY && topics[0] === PAIR_CREATED_TOPIC;
}

// function filterDumbTickers(ticker) {
//   return (ticker.includes('DOGE') || ticker.includes('BABY') || ticker.includes('SHIBA') || ticker.includes('2.0') || ticker.includes('PEPE'));
// }

async function uniswapV2PairCreated({ client, db, blockNumber, event }) {
  const { data, topics } = event;
  const pairCreatedEvent = decodeEventLog({ abi: UniswapV2FactoryABI, data, topics });

  const topic1 = trim(topics[1]).toLowerCase();
  const topic2 = trim(topics[2]).toLowerCase();
  const flipTokens = isWETH(topic1);
  const token0 = await toToken(client, flipTokens ? topic2 : topic1);
  const token1 = await toToken(client, flipTokens ? topic1 : topic2);
  const pairAddress = pairCreatedEvent.args[0].toLowerCase();

  const token0Symbol = token0.symbol.toUpperCase();
  const token1Symbol = token1.symbol.toUpperCase();

  // if (filterDumbTickers(token0Symbol) || filterDumbTickers(token1Symbol)) return;

  // @TODO: this is a slow request, attempt to replace with a local solution
  try {
    const { honeypotResult, simulationResult } = await honeypotIsRequest(token0.address, pairAddress, ETH_CHAIN_ID);
    await db.run(insertHoneypotIsResultsQuery, [token0.address, pairAddress, ETH_CHAIN_ID, honeypotResult.isHoneypot, simulationResult?.success, simulationResult?.buyTax, simulationResult?.sellTax, simulationResult?.transferTax]);
  } catch (err) {
    console.log(`honeypotIsRequest error: ${token0.address} / ${token1.address}`);
    console.log(err);
  }

  const pairName = `${token0Symbol}_${token1Symbol}_V2`;

  await db.run(insertScreenerPairQuery, [pairName, ETH_CHAIN_ID, pairAddress, flipTokens, token0.address, token0Symbol, token0.decimals, token1.address, token1Symbol, token1.decimals, Number(blockNumber)]);

  return { pairAddress, pair: pairName, flipTokens };
}

async function watchedPairEvent({ client, db, pair, event }) {
  const { pairAddress, flipTokens } = pair;
  const { data, topics } = event;
  const { eventName, args } = decodeEventLog({ abi: UniswapV2PairABI, data, topics });

  if (WATCHED_EVENTS.includes(eventName)) {
    const { blockNumber, transactionIndex, logIndex, transactionHash } = event;
    const { from: maker } = await client.getTransaction({ hash: transactionHash });
    const { sender } = args;

    let amounts = [];
    if (eventName === MINT) {
      const { amount0, amount1 } = args;
      amounts = [amount0.toString(), '0', amount1.toString(), '0'];
    } else if (eventName === BURN) {
      const { amount0, amount1 } = args;
      amounts = ['0', amount0.toString(), '0', amount1.toString()];
    } else if (eventName === SWAP) {
      const { amount0In, amount0Out, amount1In, amount1Out } = args;
      amounts = [amount0In.toString(), amount0Out.toString(), amount1In.toString(), amount1Out.toString()];
    }

    if (flipTokens) amounts = [amounts[2], amounts[3], amounts[0], amounts[1]];
    await db.run(insertScreenerEventQuery, [Number(blockNumber), ETH_CHAIN_ID, pairAddress, transactionIndex, logIndex, transactionHash, eventName, sender.toLowerCase(), maker.toLowerCase(), ...amounts]);
  }
}

module.exports = {
  analyzeBlock,
  watchedPairEvent
};
