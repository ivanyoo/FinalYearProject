const config = require('./config.json');
const mysql = require('mysql');

const insertImageMetric = (result) => {
  const connection = mysql.createConnection(config.AWS_DB);
  connection.connect();
  let queryValues = [result.numAnswers, result.numMatches, result.score, result.hints];
  connection.query('INSERT INTO imageMetrics (numAnswers, numMatches, score, hints) VALUES (?, ?, ?, ?)', queryValues, (err, results) => {
    connection.end();
    if (err) {
      console.log(err);
    }
  });
};

module.exports = insertImageMetric;