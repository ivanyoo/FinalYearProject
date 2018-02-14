const mysql = require('mysql');
const async = require('async');
const config = require('./config.json');
const WORDPOS = require('wordpos');
const wordpos = new WORDPOS();

const getVerifiedWords = (imageNumber, callback) => {
  const connection = mysql.createConnection(config.AWS_DB);
  let words = [];
  connection.connect();
  connection.query('SELECT word FROM occurences WHERE noOfOccurences >= ? AND imageID = ?', [config.VERIFIED_THRESHOLD, imageNumber], (err, result) => {
    connection.end();
    if (err) {
      return callback();
    } else {
      async.each(result, (row, nextRow) => {
        words.push(row.word);
        nextRow();
      }, () => {
        return callback(words);
      });
    }
  });
};

const getHints = (words, callback) => {
  let hintsList = [];
  async.each(words, (word, nextWord) => {
    wordpos.lookup(word, (result) => {
      let synonymList = [];
      result.forEach(synset => {
        synonymList = synonymList.concat(synset.synonyms);
      });
      synonymList = Array.from(new Set(synonymList));
      synonymList = synonymList.filter((synonym) => {
        return synonym !== word;
      });
      hintsList = hintsList.concat(synonymList);
      nextWord();
    });
  }, () => {
    hintsList = new Set(hintsList);
    hintsList = Array.from(hintsList);
    let threeRandNumbers = [];
    while (threeRandNumbers.length < 3) {
      let randNumber = Math.floor(Math.random() * hintsList.length);
      if (threeRandNumbers.indexOf(randNumber) > -1) continue;
      threeRandNumbers.push(randNumber);
    }
    const randomHints = [hintsList[threeRandNumbers[0]], hintsList[threeRandNumbers[1]], hintsList[threeRandNumbers[2]]];
    return callback(randomHints);
  });
};

const getThreeHints = (imageNumber, callback) => {
  let verifiedWords = [];
  async.series([
    (next) => {
      getVerifiedWords(imageNumber, (words) => {
        verifiedWords = words;
        next();
      });
    },
    () => {
      getHints(verifiedWords, (hints) => {
        return callback(hints);
      });
    }
  ]);
};

module.exports = getThreeHints;