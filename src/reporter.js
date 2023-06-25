const fs = require('fs');
const { toDexscreenerEth, toEtherscanAddress, toEtherscanTx } = require('./utils/utils');

const UNISWAP_PAIR_CREATED = './reports/uniswap-v2-pair-created.txt';

const TEMP_TRACKED = './reports/temp-activity-tracker'
const ERROR_LOG = './reports/error.log';

async function reportUniswapV2PairCreated(info) {
  const { symbol0, symbol1, address, pair, value, supplied, totalSupply } = info;
  const report = `${symbol0} / ${symbol1}
${toEtherscanAddress(address)}
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
  await fs.promises.appendFile(ERROR_LOG, `${report.blockNumber}\n`);
}

module.exports = {
  reportError,
  reportTrackedWalletActivity,
  reportUniswapV2PairCreated
};
