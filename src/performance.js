const { formatUnits } = require('viem');

const PRECISION = 0.001;

// generate a map of addresses and their cumulative performance
function generatePerformanceData(swaps, token0Decimals, token1Decimals, currentPrice) {
  const performanceData = {};
  const unknownSwaps = [];

  swaps.forEach(swap => {
    const { maker_address: maker, tx_hash: tx, token0_in: token0In, token0_out: token0Out, token1_in: token1In, token1_out: token1Out } = swap;

    const token1inDelta = Number(formatUnits(BigInt(token1In), token1Decimals));
    const token0Delta = Number(formatUnits(BigInt(token0Out) - BigInt(token0In), token0Decimals));
    const token1Delta = Number(formatUnits(BigInt(token1Out) - BigInt(token1In), token1Decimals));

    const isBuy = token0Delta > 0;

    if (!performanceData[maker] && isBuy) {
      const token0value = Number(token0Delta) * Number(currentPrice);
      const token0Balance = token0Delta > 0 ? token0Delta : 0;
      const token1Balance = token1Delta > 0 ? token1Delta : 0;
      const totalValue = token0Balance * currentPrice + token1Balance;
      const costBasis = (token1In / 10 ** token1Decimals);

      performanceData[maker] = {
        token0TotalDelta: token0Delta,
        token1TotalDelta: token1Delta,
        token0Balance,
        token1Balance,
        token0value: token0Balance / currentPrice,
        costBasis: token1inDelta,
        totalValue,
        pnl: token0value - costBasis,
        trades: [tx]
      }
    } else if (performanceData[maker]) {
      performanceData[maker].token0TotalDelta += token0Delta;
      performanceData[maker].token1TotalDelta += token1Delta;
      performanceData[maker].costBasis += token1inDelta;

      const { token0TotalDelta, token1TotalDelta, costBasis } = performanceData[maker];
      const newToken0Balance = token0TotalDelta > 0 ? token0TotalDelta : 0;
      const newToken1Balance = token1TotalDelta > 0 ? token1TotalDelta : 0;
      const newToken0Value = newToken0Balance / currentPrice > PRECISION ? newToken0Balance / currentPrice : 0;
      const newTotalValue = newToken0Value + newToken1Balance;

      performanceData[maker].token0Balance = newToken0Balance;
      performanceData[maker].token1Balance = newToken1Balance;
      performanceData[maker].token0value = newToken0Value;
      performanceData[maker].totalValue = newTotalValue;
      performanceData[maker].pnl = newTotalValue - costBasis;
      performanceData[maker].trades.push(tx);
    } else {
      unknownSwaps.push(swap);
    }
  });

  // console.log(unknownSwaps.length);

  const performanceArray = Object.entries(performanceData);
  performanceArray.sort((a, b) => b[1].token1TotalDelta - a[1].token1TotalDelta);

  return performanceArray;
}

module.exports = {
  generatePerformanceData
};
