const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const { generateNaivePerformanceData } = require('../src/performance-naive');
const { writeToFile } = require('../src/utils');

(async () => {
  const db = await open({
    filename: 'monitor-node.db',
    driver: sqlite3.Database
  });

  const tableName = 'EMOTI_WETH_V2'
  const {
    token0Decimals,
    token1Decimals
  } = await db.get('SELECT * FROM historical_pairs WHERE pair = ?', [tableName]);

  const swaps = await db.all(`SELECT * FROM ${tableName} WHERE eventName = ? ORDER BY block, txIndex, logIndex`, ['Swap']);

  const performanceData = generateNaivePerformanceData(swaps, token0Decimals, token1Decimals);

  if (performanceData.topPerformers.length > 0) {
    await writeToFile(`./reports/performance-${tableName}.json`, performanceData);

    for (const topPerformer of performanceData.topPerformers) {
      const insertWalletToReviewQuery = 'INSERT OR IGNORE INTO wallets_for_review (address) VALUES (?)'
      await db.run(insertWalletToReviewQuery, topPerformer);
    }
  }
})();
