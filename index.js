const { createPublicClient, webSocket } = require('viem');
const { mainnet } = require('viem/chains');

const { analyzeBlock } = require('./src/common');
const CONFIG = require('./config.json');

const transport = webSocket(CONFIG.wsLocal);
const client = createPublicClient({
  chain: mainnet,
  transport
});

client.watchBlockNumber({
  onBlockNumber: block => parseBlockNumber(block)
});

async function parseBlockNumber(blockNumber) {
  // @PITFALL - block is unfinalized at this point, uncertain if a delay is needed for accurate results

  // console.log(`parseBlockNumber: ${blockNumber}`);
  // console.log(`https://etherscan.io/block/${blockNumber}`);

  await analyzeBlock({ client, blockNumber, outputToFile: false });
};
