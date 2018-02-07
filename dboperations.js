const mysql = require('mysql');
const async = require('async');
const config = require('./config.json');
const connection = mysql.createConnection(config.AWS_DB);
var wordnet = require('wordnet-magic');
var wn = wordnet();


const updateDBOccurences = () => {
  let images = [];
  connection.connect();
  async.series([
    (next) => {
      connection.query('SELECT id, tags FROM pixabay_images', (err, result) => {
        if (err) {
          console.log(err);
        } else {
          result.forEach(image => {
            images.push({id: image.id,tags: image.tags.split(', ')});
          });
          async.nextTick(next);
        }
      });
    },
    (next) => {
      async.eachLimit(images, 1, (image, nextImage) => {
        async.eachLimit(image.tags, 1, (tag, nextTag) => {
          connection.query('INSERT INTO occurences (imageID,word,noOfOccurences) VALUES (?,?,?)',[image.id, tag, config.VERIFIED_THRESHOLD], (err, results) => {
            if (err) {
              console.log(err);
            } else {
              async.nextTick(nextTag);
            }
          });
        }, nextImage);
      }, (err) => {
        connection.end();
        next();
      });
    }
  ]);
};

const getHyponyms = (word, callback) => {
  var wordnetWord = new wn.Word(word);
  wordnetWord.getSynsets((err, data) => {
    if (data[0]) {
      data[0].getHyponymsTree((err, result) => {
        if(result[0]){
          async.eachLimit(result, 1, (synset,nextSynset) => {
            if (synset.hyponym.length > 0) {
              return callback([1]);
            }
            nextSynset();
          }, () => {
            return callback([]);
          });
        } else {
          callback([]);
        }
      });
    } else {
      return callback([]);
    }
  });
};


const getHypernyms = (word, callback) => {
  var wordnetWord = new wn.Word(word);
  wordnetWord.getSynsets((err, data) => {
    if (data[0]) {
      data[0].getHypernymsTree((err, result) => {
        if (result[0]) {
          async.eachLimit(result, 1, (synset, nextSynset) => {
            console.log(result[0].hypernym[0].hypernym[0].hypernym[0].hypernym[0]);
            if (synset.hypernym.length > 0) {
              return callback([1]);
            }
            nextSynset();
          }, () => {
            return callback([]);
          });
        } else {
          return callback([]);
        }
      });
    } else {
      return callback([]);
    }
  });
};

const hasHypernyms = (word, callback) => {
  getHypernyms(word, (hypernymslist) => {
    if (hypernymslist.length > 0) {
      return callback(true);
    }
    return callback(false);
  });
};

const hasHyponyms = (word, callback) => {
  getHyponyms(word, (hyponymslist) => {
    if (hyponymslist.length > 0) {
      return callback(true);
    }
    return callback(false);
  });
};

// const hasHypernyms = (word, callback) => {
//   var wordnetWord = new wn.Word(word);
//   wordnetWord.getSynsets((err, data) => {
//     data.forEach(synset => {
//       synset.getHypernyms((err, hypernym) => {
//         if(hypernym[0]) {
//           console.log(hypernym[0].words);
//           return callback(true);
//         }
//         return callback(false);
//       });
//     });
//   });
// };

const getScore = (word, callback) => {
  let hyponyms = false;
  let hypernyms = false;
  let score = 0;
  async.series([
    (next) => {
      hasHyponyms(word, (hasHyponym) => {
        hyponyms = hasHyponym;
        next();
      });
    },
    (next) => {
      hasHypernyms(word, (hasHypernym) => {
        hypernyms = hasHypernym;
        next();
      });
    },
    (next) => {
      if (hyponyms && hypernyms) {
        score = 200;
      } else if (hyponyms && !hypernyms) {
        score = 100;
      } else if (!hyponyms && hypernyms) {
        score = 300;
      } else {
        score = 150;
      }
      async.nextTick(next);
    }
  ], () => {
    return callback(score);
  });
};

const getImageHyponyms = (imageId, callback) => {
  var hyponyms = [];
  connection.connect();
  connection.query('SELECT word FROM occurences WHERE noOfOccurences >= ? AND imageID = ?', [config.VERIFIED_THRESHOLD, imageId], (err, results) =>{
    connection.end();
    if (err) {
      return callback(err);
    }
    async.each(results, (tag, nextTag) => {
      getHyponyms(tag.word, lemmaList => {
        console.log(lemmaList);
        hyponyms += lemmaList;
        async.nextTick(nextTag);
      });
    }, () => {
      callback(hyponyms);
    });
  });
};

const getImageHypernyms = (imageId, callback) => {
  var hypernyms = [];
  connection.connect();
  connection.query('SELECT word FROM occurences WHERE noOfOccurences >= ? AND imageID = ?', [config.VERIFIED_THRESHOLD, imageId], (err, results) =>{
    connection.end();
    if (err) {
      return callback(err);
    }
    async.each(results, (tag, nextTag) => {
      getHypernyms(tag.word, lemmaList => {
        hypernyms = hypernyms.concat(lemmaList);
        async.nextTick(nextTag);
      });
    }, () => {
      callback(hypernyms);
    });
  });
};

// getImageHyponyms(8, console.log);
// getImageHypernyms(8, (word) => {
//   console.log(word);
// });
// getHypernyms('thing', console.log)

// getScore('cat', (score) => {
//   console.log(score);
// });

module.exports = getScore;

// hasHypernyms('thing', (result) => {
//   console.log(result);
// });