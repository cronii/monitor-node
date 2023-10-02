const { decodeEventLog, formatUnits } = require('viem');

const { UniswapV2PairABI, UniswapV3PairABI } = require('./abis');
const { isWETH, toToken, truncateDecimal } = require('./utils');
const { ETH_CHAIN_ID, UNI_V2_SWAP_TOPIC, UNI_V3_SWAP_TOPIC } = require('./utils/constants');
const { INSERT_WATCHED_WALLET_SWAP_QUERY, INSERT_WATCHED_WALLET_PAIR_QUERY } = require('./utils/queries');

const SWAP_TOPICS = [UNI_V2_SWAP_TOPIC, UNI_V3_SWAP_TOPIC];
const TOPIC_MAPPINGS = {
  [UNI_V2_SWAP_TOPIC]: { abi: UniswapV2PairABI, getSwapInfo: getUniswapV2SwapInfo, pairSuffix: 'V2' },
  [UNI_V3_SWAP_TOPIC]: { abi: UniswapV3PairABI, getSwapInfo: getUniswapV3SwapInfo, pairSuffix: 'V3' }
};

// @TODO this is temporary storage of whitelisted contracts
// const WHITELISTED_CONTRACTS = [
//   '0x9008d19f58aabd9ed0d60971565aa8510560ab41' // cowswap
// ];

// @TODO eventually need to track any transfers out of wallets

async function analyzeBlock({ client, db, blockNumber }) {
  const blockNumberString = blockNumber.toString();
  console.time(blockNumberString);

  // @TODO potentially move or cache this
  const wallets = db.prepare('SELECT address FROM watched_wallets').all();
  const walletSet = new Set(wallets.map(wallet => wallet.address.toLowerCase()));

  // @TODO - this is a temporary solution
  // const contractSet = new Set(WHITELISTED_CONTRACTS.map(contract => contract.toLowerCase()));

  const { hash: blockHash, transactions, timestamp } = await client.getBlock({ blockNumber });
  const events = await client.getLogs({ blockHash });

  // get all swap events and their corresponding txs
  const { swapEvents, txPromises } = events.reduce((acc, event) => {
    const { transactionHash, transactionIndex, topics } = event;
    if (SWAP_TOPICS.includes(topics[0])) {
      acc.swapEvents.push(event);
      acc.txPromises[transactionIndex] = client.getTransaction({ hash: transactionHash });
    }
    return acc;
  }, { swapEvents: [], txPromises: new Array(transactions.length) });

  const txs = await Promise.all(txPromises);

  for (const event of swapEvents) {
    const { transactionIndex, topics, data, address: pairAddress, logIndex, transactionHash } = event;
    const { from } = txs[transactionIndex];
    const maker = from.toLowerCase();

    try {
      // @TODO current this does not account for cowswap trades
      // i think, you have to pull the event group and check the Trade event
      if (walletSet.has(maker)) {
        const topicMapping = TOPIC_MAPPINGS[topics[0]];

        if (topicMapping) {
          const { abi, getSwapInfo, pairSuffix } = topicMapping;
          const { args } = decodeEventLog({ abi, data, topics });

          // check if pairs data is already in db
          let token0, token1;
          const pairsData = db.prepare('SELECT * FROM watched_wallet_pairs WHERE pairAddress = ?').get(pairAddress);

          if (!pairsData) {
            const { token0: newToken0, token1: newToken1, flipTokens } = await getPairData({ client, abi, pairAddress });

            const quoteSymbol = newToken0.symbol.toUpperCase();
            const baseSymbol = newToken1.symbol.toUpperCase();
            const pairName = `${quoteSymbol}_${baseSymbol}_${pairSuffix}`;

            const insertWatchedWalletPairQuery = db.prepare(INSERT_WATCHED_WALLET_PAIR_QUERY)
            insertWatchedWalletPairQuery.run({
              pairName,
              chainId: ETH_CHAIN_ID,
              pairAddress,
              token0: newToken0.address,
              token1: newToken1.address,
              token0Symbol: newToken0.symbol,
              token1Symbol: newToken1.symbol,
              token0Decimals: newToken0.decimals,
              token1Decimals: newToken1.decimals,
              flipTokens: flipTokens ? 1 : 0
            });

            token0 = flipTokens ? newToken1 : newToken0;
            token1 = flipTokens ? newToken0 : newToken1;
          } else {
            const { flipTokens } = pairsData;
            token0 = {
              address: flipTokens ? pairsData.token1 : pairsData.token0,
              symbol: flipTokens ? pairsData.token1Symbol : pairsData.token0Symbol,
              decimals: flipTokens ? pairsData.token1Decimals : pairsData.token0Decimals
            };
            token1 = {
              address: flipTokens ? pairsData.token0 : pairsData.token1,
              symbol: flipTokens ? pairsData.token0Symbol : pairsData.token1Symbol,
              decimals: flipTokens ? pairsData.token0Decimals : pairsData.token1Decimals
            };
          }

          // @TODO currently this only inserts maker, but does not account for cowswap's end recipient
          const swapInfo = getSwapInfo({ args, token0, token1 });
          await insertSwap(db, {
            maker,
            txHash: transactionHash,
            chainId: ETH_CHAIN_ID,
            block: Number(blockNumber),
            txIndex: transactionIndex,
            logIndex,
            pairAddress,
            timestamp: Number(timestamp),
            ...swapInfo
          });
        }
      }
    } catch (err) {
      console.error(transactionHash);
      console.error(err);
    }
  }

  console.timeEnd(blockNumber.toString());
}

async function getWatchedWalletActivity({ db }) {
  const recentSwaps = db.prepare('SELECT * FROM watched_wallet_view ORDER BY timestamp DESC, txIndex DESC, logIndex DESC LIMIT 250').all();
  const recentPairsQuery = db.prepare(`SELECT *, COUNT(*) as swapCount, COUNT(DISTINCT subquery.maker) as uniqueCount
    FROM (
      SELECT *
      FROM watched_wallet_view
      ORDER BY timestamp DESC, txIndex DESC, logIndex DESC
      LIMIT 250
    ) AS subquery
    GROUP BY pairAddress
    ORDER BY COUNT(*) DESC`)
  const recentPairs = recentPairsQuery.all();

  return { recentPairs, recentSwaps };
}

async function getPairData({ client, abi, pairAddress }) {
  const pairContract = {
    address: pairAddress,
    abi
  };

  const rawPairData = await client.multicall({
    contracts: [
      {
        ...pairContract,
        functionName: 'token0'
      },
      {
        ...pairContract,
        functionName: 'token1'
      }
    ]
  });

  // make WETH as the base pair (token1)
  const rawToken0 = rawPairData[0].result.toLowerCase();
  const rawToken1 = rawPairData[1].result.toLowerCase();
  const flipTokens = isWETH(rawToken0);
  const token0 = await toToken(client, flipTokens ? rawToken1 : rawToken0);
  const token1 = await toToken(client, flipTokens ? rawToken0 : rawToken1);

  return {
    flipTokens,
    token0,
    token1
  };
}

function getUniswapV2SwapInfo({ args, token0, token1 }) {
  const { amount0In, amount0Out, amount1In, amount1Out } = args;
  const isBuy = amount1Out > 0n;

  return {
    tokenSold: isBuy ? token0 : token1,
    amountSold: isBuy ? amount0In : amount1In,
    tokenBought: isBuy ? token1 : token0,
    amountBought: isBuy ? amount1Out : amount0Out
  }
}

function getUniswapV3SwapInfo({ args, token0, token1 }) {
  const { amount0, amount1 } = args;
  const isBuy = amount0 > 0n;

  return {
    tokenSold: isBuy ? token0 : token1,
    amountSold: isBuy ? amount0 : amount1,
    tokenBought: isBuy ? token1 : token0,
    amountBought: isBuy ? -amount1 : -amount0
  }
}

async function insertSwap(db, swapInfo) {
  const { block, chainId, txHash, txIndex, logIndex, maker, pairAddress, tokenSold, amountSold, tokenBought, amountBought, timestamp } = swapInfo;
  const displayAmountSold = truncateDecimal(formatUnits(amountSold, tokenSold.decimals));
  const displayAmountBought = truncateDecimal(formatUnits(amountBought, tokenBought.decimals));

  const insertWatchedWalletEventQuery = db.prepare(INSERT_WATCHED_WALLET_SWAP_QUERY);
  insertWatchedWalletEventQuery.run({
    maker,
    txHash,
    chainId,
    block,
    txIndex,
    logIndex,
    pairAddress,
    tokenSold: tokenSold.address,
    amountSold: displayAmountSold,
    tokenBought: tokenBought.address,
    amountBought: displayAmountBought,
    timestamp
  });
}

module.exports = {
  analyzeBlock,
  getWatchedWalletActivity
};
