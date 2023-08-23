const { createPublicClient, webSocket } = require('viem');
const { mainnet } = require('viem/chains');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

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

  const db = await open({
    filename: 'monitor-node.db',
    driver: sqlite3.Database
  });

  await analyzeBlock({ client, db, blockNumber, outputToFile: false });
  await db.close();
};
