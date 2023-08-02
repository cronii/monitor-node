const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const { tagWallet } = require('../src/utils');

(async () => {
  const db = await open({
    filename: 'monitor-node.db',
    driver: sqlite3.Database
  });

  const TABLE_NAME = 'TETRIS_WETH_V2';
  const WALLET_TAG = 'Liquidity Sniper';
  const ALLOW_DUPE_TAG = true;

  const getInitialLiquidityAddQuery = `SELECT * FROM ${TABLE_NAME} ORDER BY block, tx_index, log_index`;
  const { block, event_name: eventName } = await db.get(getInitialLiquidityAddQuery);

  if (eventName !== 'Mint') console.error('First event is not Mint');

  const getLiquiditySnipersQuery = `SELECT * FROM ${TABLE_NAME} WHERE block = ? AND event_name = ?`;
  const liquiditySnipers = await db.all(getLiquiditySnipersQuery, [block, 'Swap']);

  for (const liquiditySniper of liquiditySnipers) {
    const { maker_address: address } = liquiditySniper;
    await tagWallet(db, address, WALLET_TAG, ALLOW_DUPE_TAG);
  }
})();
