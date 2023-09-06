const { formatUnits } = require('viem');

// generate a map of addresses and their cumulative performance
function generateNaivePerformanceData(swaps, token0Decimals, token1Decimals) {
  const performanceData = {};
  const unmatchedSwaps = [];
  const uniqueTopPerformers = new Set();
  const topPerformers = [];

  swaps.forEach(swap => {
    const { makerAddress: maker, txHash: tx, token0In, token0Out, token1In, token1Out } = swap;

    const token1inDelta = Number(formatUnits(BigInt(token1In), token1Decimals));
    const token0Delta = Number(formatUnits(BigInt(token0Out) - BigInt(token0In), token0Decimals));
    const token1Delta = Number(formatUnits(BigInt(token1Out) - BigInt(token1In), token1Decimals));

    const isBuy = token0Delta > 0;

    if (!performanceData[maker] && isBuy) {
      const token0Balance = token0Delta > 0 ? token0Delta : 0;
      const token1Balance = token1Delta > 0 ? token1Delta : 0;

      performanceData[maker] = {
        token0TotalDelta: token0Delta,
        token1TotalDelta: token1Delta,
        token0Balance,
        token1Balance,
        costBasis: token1inDelta,
        trades: [tx]
      }
    } else if (performanceData[maker]) {
      performanceData[maker].token0TotalDelta += token0Delta;
      performanceData[maker].token1TotalDelta += token1Delta;
      performanceData[maker].costBasis += token1inDelta;

      const { token0TotalDelta, token1TotalDelta } = performanceData[maker];
      const newToken0Balance = token0TotalDelta > 0 ? token0TotalDelta : 0;
      const newToken1Balance = token1TotalDelta > 0 ? token1TotalDelta : 0;

      performanceData[maker].token0Balance = newToken0Balance;
      performanceData[maker].token1Balance = newToken1Balance;
      performanceData[maker].trades.push(tx);

      if (performanceData[maker].token1TotalDelta > 3) {
        uniqueTopPerformers.add(maker);
      }
    } else {
      unmatchedSwaps.push(swap);
    }
  });

  const performanceArray = Object.entries(performanceData);
  performanceArray.sort((a, b) => b[1].token1TotalDelta - a[1].token1TotalDelta);

  for (const topPerformer of uniqueTopPerformers) {
    topPerformers.push(topPerformer);
  }

  return { topPerformers, performanceArray, unmatchedSwaps };
}

module.exports = {
  generateNaivePerformanceData
};
