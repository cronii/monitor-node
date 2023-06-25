const fs = require('fs');
const { toDexscreenerEth } = require('./utils/utils');

const UNISWAP_PAIR_CREATED = './reports/uniswap-v2-pair-created.txt';

async function reportUniswapV2PairCreated(info) {
  const { symbol0, symbol1, pair, value, supplied, totalSupply } = info;
  const report = `${symbol0} / ${symbol1}
${toDexscreenerEth(pair)}
Initial Liquidity: ${value} ${symbol1}
Supplied: ${supplied}
Total Supply: ${totalSupply}\n\n`;

  await fs.promises.appendFile(UNISWAP_PAIR_CREATED, report);
}

module.exports = {
  reportUniswapV2PairCreated
};
