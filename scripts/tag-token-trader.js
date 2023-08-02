const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const { tagWallets } = require('../src/utils');

const TABLE_NAME = 'EMBR_WETH_V2';
const WALLET_TAG = 'EMBR';
const TAG_TYPE = 'Token';
const ALLOW_DUPE_TAG = false;

(async () => {
  const db = await open({
    filename: 'monitor-node.db',
    driver: sqlite3.Database
  });

  const getTokenTransactionsQuery = `SELECT * FROM ${TABLE_NAME} ORDER BY block, tx_index, log_index`;
  const transactions = await db.all(getTokenTransactionsQuery);

  const uniqueAddresses = transactions.reduce((uniqueSet, tx) => {
    uniqueSet.add(tx.maker_address);
    return uniqueSet;
  }, new Set());

  const results = await tagWallets(db, uniqueAddresses, WALLET_TAG, TAG_TYPE, ALLOW_DUPE_TAG);
  console.log(results);
})();
