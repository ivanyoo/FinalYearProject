const config = require('./config.json');
const mysql = require('mysql');

const insertSkipMetric = (result) => {
  const connection = mysql.createConnection(config.AWS_DB);
  connection.connect();
  let queryValues = [result.numAnswers, result.numMatches, result.timer, result.hints];
  connection.query('INSERT INTO skipMetrics (numAnswers, numMatches, timeLeft, hints) VALUES (?, ?, ?, ?)', queryValues, (err, results) => {
    connection.end();
    if (err) {
      console.log(err);
    }
  });
};

module.exports = insertSkipMetric;