const { decodeEventLog, trim } = require('viem');
const { isWETH, toToken } = require('./utils');
const { reportError } = require('./reporter');

const COMMON_ADDRESSES = require('./utils/common-addresses.json');
const { UniswapV2FactoryABI, UniswapV2PairABI } = require('./abis');

const {
  PAIR_CREATED_TOPIC,
  ETH_CHAIN_ID,
  UNISWAP_V2_FACTORY,
  SWAP,
  MINT,
  BURN,
  TOKEN_TAG,
  // DEPLOYER_TAG,
  INSIDER_TAG
} = require('./utils/constants');
const WATCHED_EVENTS = [SWAP, MINT, BURN];

const { INSERT_SCREENER_PAIR_QUERY, INSERT_SCREENER_EVENT_QUERY } = require('./utils/queries');

async function analyzeBlock({ client, db, blockNumber }) {
  const blockNumberString = blockNumber.toString();
  console.time(blockNumberString);

  const block = await client.getBlock({ blockNumber });
  const events = await client.getLogs({ blockHash: block.hash });

  try {
    const txs = await analyzeTransactions({ client, db, txHashes: block.transactions });
    await analyzeEvents({ client, db, events, txs });

    // @TODO check liquidity of watched pairs?
  } catch (err) {
    console.log(err);
    await reportError({ blockNumber: blockNumberString })
  }

  console.timeEnd(blockNumber.toString());
}

async function analyzeTransactions({ client, db, txHashes }) {
  const txPromises = txHashes.map(txHash => client.getTransaction({ hash: txHash }));
  const txs = await Promise.all(txPromises);

  // for (const tx of txs) {
  //   if (tx.creates !== null) {
  //     // const address = tx.creates;
  //     const deployer = tx.from;

  //     const insertDeployerWallet = 'INSERT OR IGNORE INTO wallets (address) VALUES (?)';
  //     await db.run(insertDeployerWallet, [deployer.toLowerCase()]);

  //     const insertPairCreatorWalletTag = 'INSERT OR IGNORE INTO wallet_tags (address, tag, type) VALUES (?, ?, ?)';
  //     await db.run(insertPairCreatorWalletTag, [deployer.toLowerCase(), DEPLOYER_TAG, INSIDER_TAG]);
  //   }
  // }

  return txs;
}

// @TODO: reuse TXS from analyzeTransactions

async function analyzeEvents({ client, db, events, txs }) {
  const getWatchedPairsQuery = db.prepare('SELECT pairAddress, pair, flipTokens, token0Symbol FROM watched_pairs');
  const watchedPairs = getWatchedPairsQuery.all();
  const watchedPairAddresses = watchedPairs.map(pair => pair.pairAddress.toLowerCase());

  for (const event of events) {
    const { address, topics } = event;

    if (isUniswapV2PairCreated(address, topics)) {
      const newPair = await uniswapV2PairCreated({ client, db, event, txs });
      if (newPair) {
        watchedPairs.push(newPair);
        watchedPairAddresses.push(newPair.pairAddress);
      }
    } else if (watchedPairAddresses.includes(address.toLowerCase())) {
      const pair = watchedPairs[watchedPairAddresses.indexOf(address.toLowerCase())];
      await watchedPairEvent({ client, db, pair, event, txs });
    }
  }
}

function isUniswapV2PairCreated(address, topics) {
  return COMMON_ADDRESSES[address]?.name === UNISWAP_V2_FACTORY && topics[0] === PAIR_CREATED_TOPIC;
}

// function filterDumbTickers(ticker) {
//   return (ticker.includes('DOGE') || ticker.includes('BABY') || ticker.includes('SHIBA') || ticker.includes('2.0') || ticker.includes('PEPE'));
// }

async function uniswapV2PairCreated({ client, db, event, txs }) {
  const { data, topics, blockNumber, transactionIndex } = event;
  const pairCreatedEvent = decodeEventLog({ abi: UniswapV2FactoryABI, data, topics });

  const { from: pairCreator } = txs[transactionIndex];

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
  // try {
  //   const { honeypotResult, simulationSuccess, simulationResult } = await honeypotIsRequest(token0.address, pairAddress, ETH_CHAIN_ID);
  //   await db.run(insertHoneypotIsResultsQuery, [token0.address, pairAddress, ETH_CHAIN_ID, honeypotResult?.isHoneypot, simulationSuccess, simulationResult?.buyTax, simulationResult?.sellTax, simulationResult?.transferTax]);
  // } catch (err) {
  //   console.log(`honeypotIsRequest error: ${token0.address} / ${token1.address}`);
  //   console.log(err);
  // }

  const pairName = `${token0Symbol}_${token1Symbol}_V2`;
  // await db.run(insertScreenerPairQuery, [pairName, ETH_CHAIN_ID, pairAddress, flipTokens, token0.address, token0Symbol, token0.decimals, token1.address, token1Symbol, token1.decimals, Number(blockNumber)]);
  const insertScreenerPairQuery = db.prepare(INSERT_SCREENER_PAIR_QUERY);
  insertScreenerPairQuery.run({
    pair: pairName,
    chainId: ETH_CHAIN_ID,
    pairAddress,
    flipTokens: flipTokens ? 1 : 0,
    token0: token0.address,
    token0Symbol,
    token0Decimals: token0.decimals,
    token1: token1.address,
    token1Symbol,
    token1Decimals: token1.decimals,
    deployBlock: Number(blockNumber)
  });

  const insertPairCreatorWalletQuery = db.prepare('INSERT OR IGNORE INTO wallets (address) VALUES ($address)');
  insertPairCreatorWalletQuery.run({ address: pairCreator.toLowerCase() });

  const insertPairCreatorWalletTagQuery = db.prepare('INSERT OR IGNORE INTO wallet_tags (address, tag, type) VALUES (?, ?, ?)');
  insertPairCreatorWalletTagQuery.run(pairCreator.toLowerCase(), token0Symbol, TOKEN_TAG);
  insertPairCreatorWalletTagQuery.run(pairCreator.toLowerCase(), `${token0Symbol} Pair Creator`, INSIDER_TAG);

  return { pairAddress, pair: pairName, flipTokens };
}

async function watchedPairEvent({ db, pair, event, txs }) {
  const { pairAddress, flipTokens, token0Symbol } = pair;
  const { data, topics } = event;
  const { eventName, args } = decodeEventLog({ abi: UniswapV2PairABI, data, topics });

  if (WATCHED_EVENTS.includes(eventName)) {
    const { blockNumber, transactionIndex, logIndex, transactionHash } = event;
    const { from: maker } = txs[transactionIndex];
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

    const insertScreenerEventQuery = db.prepare(INSERT_SCREENER_EVENT_QUERY);
    // await db.run(insertScreenerEventQuery, [Number(blockNumber), ETH_CHAIN_ID, pairAddress, transactionIndex, logIndex, transactionHash, eventName, sender.toLowerCase(), maker.toLowerCase(), ...amounts]);
    insertScreenerEventQuery.run({
      block: Number(blockNumber),
      chainId: ETH_CHAIN_ID,
      pairAddress,
      txIndex: transactionIndex,
      logIndex,
      txHash: transactionHash,
      eventName,
      senderAddress: sender.toLowerCase(),
      makerAddress: maker.toLowerCase(),
      token0In: amounts[0],
      token0Out: amounts[1],
      token1In: amounts[2],
      token1Out: amounts[3]
    });

    // insert and tag unique wallets
    const insertMakerWalletQuery = db.prepare('INSERT OR IGNORE INTO wallets (address) VALUES (?)');
    insertMakerWalletQuery.run(maker.toLowerCase());

    const insertMakerWalletTagQuery = db.prepare('INSERT OR IGNORE INTO wallet_tags (address, tag, type) VALUES (?, ?, ?)');
    insertMakerWalletTagQuery.run(maker.toLowerCase(), token0Symbol, TOKEN_TAG);

    const updatePairQuery = db.prepare('UPDATE screener_pairs SET lastUpdateBlock = ? WHERE pairAddress = ?');
    updatePairQuery.run(Number(blockNumber), pairAddress);
  }
}

async function analyzeWatchedPairs({ client, db }) {
  const getWatchedPairsQuery = db.prepare(`SELECT wp.*, COUNT(se.txId) AS eventCount
      FROM watched_pairs wp
      LEFT JOIN screener_events se ON wp.pairAddress = se.pairAddress AND wp.chainId = se.chainId
      GROUP BY wp.pairAddress
      ORDER BY deployBlock DESC`);
  const watchedPairs = getWatchedPairsQuery.all(getWatchedPairsQuery);

  console.log(`watchedPairs: ${watchedPairs.length}`);

  // get base token balances for each pair
  const detailedWatchedPairs = await Promise.all(watchedPairs.map(async watchedPair => {
    const { pairAddress, flipTokens } = watchedPair;
    const pairReserves = await client.readContract({
      address: pairAddress,
      abi: UniswapV2PairABI,
      functionName: 'getReserves'
    });

    const baseReserves = flipTokens ? pairReserves[0] : pairReserves[1];
    return { ...watchedPair, baseReserves: baseReserves.toString() };
  }));

  return detailedWatchedPairs;
}

module.exports = {
  analyzeBlock,
  watchedPairEvent,
  analyzeWatchedPairs
};
