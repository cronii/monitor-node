const fs = require('fs');
const csv = require('csv-parser');
const Database = require('better-sqlite3');

// Replace with your CSV file path and SQLite database file path
const csvFilePath = './input/wallets.csv';
const db = new Database('monitor-node.db');

// Function to insert a row into the table
function insertRow(row) {
  const stmt = db.prepare('INSERT OR IGNORE INTO watched_wallets (address) VALUES (?)');
  stmt.run(row.address.toLowerCase());
}

// Read and parse the CSV file
fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (row) => {
    // Insert each row into the table
    insertRow(row);
  })
  .on('end', () => {
    console.log('CSV data inserted into SQLite table.');
    db.close();
  });
