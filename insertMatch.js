const config = require('./config.json');
const mysql = require('mysql');

const insertMatch = (result) => {
  const connection = mysql.createConnection(config.AWS_DB);
  connection.connect();
  let queryValues = [result.score, result.word, result.timeTaken, result.hints];
  connection.query('INSERT INTO matches (score, word, timeTaken, hints) VALUES (?, ?, ?, ?)', queryValues, (err, results) => {
    connection.end();
    if (err) {
      console.log(err);
    }
  });
};

module.exports = insertMatch;