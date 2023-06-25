const fs = require('fs');
const { toDexscreenerEth, toEtherscanTx } = require('./utils/utils');

const UNISWAP_PAIR_CREATED = './reports/uniswap-v2-pair-created.txt';

const TEMP_TRACKED = './reports/temp-activity-tracker'
const ERROR_LOG = './reports/error-log';

async function reportUniswapV2PairCreated(info) {
  const { symbol0, symbol1, pair, value, supplied, totalSupply } = info;
  const report = `${symbol0} / ${symbol1}
${toDexscreenerEth(pair)}
Initial Liquidity: ${value} ${symbol1}
Supplied: ${supplied}
Total Supply: ${totalSupply}\n\n`;

  await fs.promises.appendFile(UNISWAP_PAIR_CREATED, report);
}

async function reportTrackedWalletActivity(address, tx) {
  const report = `${address}: ${toEtherscanTx(tx)}`
  await fs.promises.appendFile(TEMP_TRACKED, report);
}

async function reportError(report) {
  await fs.promises.appendFile(ERROR_LOG, JSON.stringify(report, null, 2));
}

module.exports = {
  reportError,
  reportTrackedWalletActivity,
  reportUniswapV2PairCreated
};
