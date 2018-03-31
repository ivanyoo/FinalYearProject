const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const passwordHash = require('password-hash');
const app = require('express')();
const path = require('path');
const WORDPOS = require('wordpos');
const server = require('http').Server(app);
const config = require('./config.json');
const io = require('socket.io')(server);
const getScore = require('./dboperations');
const insertMatch = require('./insertMatch');
const insertImageMetric = require('./insertImageMetric');
const insertSkipMetric = require('./insertSkipMetric');
const Queue = require('./Queue.src');
const stemmer = require('stemmer');
const getHints = require('./hints');
const wordpos = new WORDPOS();
server.listen(80);
let userid = 1;
let roomNumber = 1;
const gameModeQueues = [new Queue(), new Queue()];
const testQueues = [new Queue(), new Queue()];
const opponentSockets = [{},{}];
const testOpponentSockets = [{}, {}];
const maxTestImages = 20;

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', (req, res) => {
   res.send('root');
});

app.post('/login', (req, res) => {
  const connection = mysql.createConnection(config.AWS_DB);
  connection.connect();
  connection.query('SELECT hashedPassword FROM users WHERE username = ?', [req.body.username], (err, results) => {
    if (err) {
       console.log(err);
    }
    if (!results[0]) {
       connection.query('INSERT INTO users (username, hashedPassword) VALUES (?,?)', [req.body.username, passwordHash.generate(req.body.password)], (error, response) => {
          connection.end();
          if (error) {
             console.log(error);
          }
          res.json({error: null});
       });
    } else {
       connection.end();
       if (passwordHash.verify(req.body.password, results[0].hashedPassword)) {
         res.json({ error: null });
       } else {
         res.json({ error: 'Wrong password'});
       }
    }
  });
});


const getRandomImageNumber = () => {
  let bannedNumbers = [1, 288, 317, 163];
  const min = 2;
  const max = 600;
  let number = Math.floor(Math.random() * (max - min)) + min;
  while (bannedNumbers.indexOf(number) > -1) {
    number = Math.floor(Math.random() * (max - min)) + min;
  }
  return number;
};

// queries the database for url of image with id = imageNumber
const getImage= (imageNumber, callback) => {
  return callback(null, `https://s3-eu-west-1.amazonaws.com/114344211.photo-tagging/pixabay_images/${imageNumber}.jpg`);
};

const updateScore = (player, score, callback) => {
  const connection = mysql.createConnection(config.AWS_DB);
  connection.connect();
  connection.query('UPDATE users SET totalPoints = totalPoints + ? WHERE username = ?',[score, player], (err, results) => {
    connection.end();
    if (err) {
      console.log(err);
      return callback(err);
    }
    callback(null);
  });
};

const upsertOccurence = (imageID, word, callback) => {
  const connection = mysql.createConnection(config.AWS_DB);
  connection.connect();
  connection.query('INSERT INTO occurences (imageID, word, noOfOccurences) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE noOfOccurences = noOfOccurences + 1', [imageID, word], (err, results) =>{
    connection.end();
    if (err) {
      console.log(err);
      return callback(err);
    }
    callback(null);
  });
};

io.on('connection', (socket) => {
   let sessionRoomNumber;
   let username;
   let opponent;
   let gameMode;
   let timer;
   let image = 1;
   let hints = 1;
   let words = [];
   let host;
   let opponentWords = [];
   let score = 0;
   let numMatches = 0;
   let hangmanWords = [];
   let hangmanIndex = 0;
   let setImages = [2,12,16,5,6,7,8,14,15,11];
   let imageIndex = 0;

  const finishGame = () => {
    console.log('finished');
    opponent.socket.emit('finishTestEvent');
    socket.emit('finishTestEvent');
  };


  const sendNewImage = () => {
     if (host === username) {
       image = getRandomImageNumber();
       if (gameMode === 'test1' ||  gameMode === 'test2') {
         imageIndex++;
         if (imageIndex < setImages.length) {
           image = setImages[imageIndex];
         }
         if (imageIndex > maxTestImages) {
           finishGame();
           return;
         }
       }
       getImage(image, (err, results) => {
         if (gameMode === 'test1') {
           getHints(image, hintslist => {
             socket.emit('newImageEvent', {imageURL: results, hints: hintslist});
             opponent.socket.emit('newImageEvent', {imageURL: results, hints: hintslist});
           });
         } else {
           socket.emit('newImageEvent', {imageURL: results, hints: []});
           opponent.socket.emit('newImageEvent', {imageURL: results, hints: []});
         }
       });
     }
   };

   socket.on('askForImageEvent', (data) => {
     sendNewImage();
     data.hints = hints;
     data.numMatches = numMatches;
     numMatches = 0;
     insertImageMetric(data);
   });

   socket.on('newHangmanImageEvent', () => {
     image = getRandomImageNumber();
     getImage(image, (err, results) => {
       getHints(image, (hintslist) => {
         let validWords = [];
         for (var word = 0; word < hintslist.length; word++) {
           if (!hintslist[word].includes(' ')) {
             validWords.push(hintslist[word]);
           }
         }
         hangmanWords = validWords;
         hangmanIndex = 0;
         socket.emit('newHangmanImageEvent', {showExit: true, image, imageURL: results, word: hangmanWords[hangmanIndex]});
       });
     });
   });

   socket.on(`answerEvent`, (data) => {
      if (gameMode === 0 || gameMode === 'test1' || gameMode === 'test2') {
        wordpos.lookup(data.answer, (result, word) => {
          if (result.length > 0) {
            opponent.socket.emit('verifiedAnswerEvent', {answer: data.answer, username: data.username});
            socket.emit('verifiedAnswerEvent', {answer: data.answer, username: data.username});
          } else {
            const stemmedWord = stemmer(data.answer);
            wordpos.lookup(stemmedWord, (result) => {
              if (result.length > 0) {
                opponent.socket.emit('verifiedAnswerEvent', {answer: stemmedWord, username: data.username});
                socket.emit('verifiedAnswerEvent', {answer: stemmedWord, username: data.username});
              }
            })
          }
        });
      } else if (gameMode === 1) {
        wordpos.isAdjective(data.answer, (result, word) => {
          if (result) {
            opponent.socket.emit('verifiedAnswerEvent', {answer: data.answer, username: data.username});
            socket.emit('verifiedAnswerEvent', {answer: data.answer, username: data.username});
          }
        });
      }
   });

   socket.on('answerMatchEvent', (data) => {
     numMatches++;
     socket.emit('renderWaitEvent', {answer: data.answer});
     opponent.socket.emit('renderWaitEvent', {answer: data.answer});
     upsertOccurence(image, data.answer, (error) => {
        getScore(data.answer, (score) => {
          updateScore(username, score , (err) => {
            updateScore(opponent.username, score, (err) => {
              socket.emit('scoreCalculatedEvent', {score: score});
              opponent.socket.emit('scoreCalculatedEvent', {score: score});
              let result = {word: data.answer, timeTaken: data.timer, score: score, hints: hints}
              insertMatch(result);
            });
          });
        });
      });
   });

   socket.on('updateImageIndexEvent',() => {
     imageIndex++;
   });

   socket.on('skipEvent', (data) => {
     updateScore(data.username,  -50, (err) => {
       updateScore(data.username === username ? opponent.username : username, 50, (err) => {
         image = getRandomImageNumber();
         if (gameMode === 'test1' ||  gameMode === 'test2') {
           imageIndex++;
           if (imageIndex < setImages.length) {
             image = setImages[imageIndex];
           }
           if (imageIndex > maxTestImages) {
             finishGame();
             return;
           }
         }
         getImage(image, (err, results) => {
           if (gameMode === 'test1') {
             getHints(image, hintslist => {
               socket.emit('skipImageEvent', {username: data.username, imageURL: results, score: 50, hints: hintslist});
               opponent.socket.emit('skipImageEvent', {username: data.username, imageURL: results, score: 50, hints: hintslist});
             });
           } else {
             socket.emit('skipImageEvent', {username: data.username, imageURL: results, score: 50, hints: []});
             opponent.socket.emit('skipImageEvent', {username: data.username, imageURL: results, score: 50, hints: []});
           }
           data.hints = hints;
           data.numMatches = numMatches;
           insertSkipMetric(data);
           numMatches = 0;
         });
       });
     });
   });

   socket.on('askForHintEvent', (data) => {
     if (data === username){
       getHints(image, (hintsList) => {
         socket.emit('sendHintEvent', {words: hintsList});
       });
     }
   });

   socket.on('newHangmanWordEvent', (data) => {
     hangmanIndex++;
     updateScore(username, data.points, (err) => {
       if (hangmanIndex === hangmanWords.length) {
         image = getRandomImageNumber();
         getImage(image, (err, results) => {
           getHints(image, (hintslist) => {
             let validWords = [];
             for (var word = 0; word < hintslist.length; word++) {
               if (!hintslist[word].includes(' ')) {
                 validWords.push(hintslist[word]);
               }
             }
             hangmanWords = validWords;
             hangmanIndex = 0;
             socket.emit('newHangmanImageEvent', {image, imageURL: results, word: hangmanWords[hangmanIndex]});
           });
         });
       } else {
         socket.emit('sendNewHangmanWordEvent', {word: hangmanWords[hangmanIndex]});
       }
     });
   });

   socket.on('skipHangmanWordEvent', data => {
     hangmanIndex++;
     updateScore(username, -100, (err) => {
       if (hangmanIndex === hangmanWords.length) {
         image = getRandomImageNumber();
         getImage(image, (err, results) => {
           getHints(image, (hintslist) => {
             let validWords = [];
             for (var word = 0; word < hintslist.length; word++) {
               if (!hintslist[word].includes(' ')) {
                 validWords.push(hintslist[word]);
               }
             }
             hangmanWords = validWords;
             hangmanIndex = 0;
             socket.emit('newHangmanImageEvent', {image, imageURL: results, word: hangmanWords[hangmanIndex]});
           });
         });
       } else {
         socket.emit('sendNewHangmanWordEvent', {word: hangmanWords[hangmanIndex]});
       }
     });
   });

  socket.on('joinRoomEvent', (data) => {
    if (!opponent) {
      opponent = opponentSockets[gameMode][data.username];
      delete opponentSockets[gameMode][data.username];
    }
    socket.emit('roomJoinedEvent',{imageURL: data.imageURL, timer});
  });

  socket.on('sendTestOneOpponent', (data) => {
    if(!opponent) {
      opponent = testOpponentSockets[0][data.username];
      delete testOpponentSockets[0][data.username];
    }
    socket.emit('joinTestOneEvent', data);
  });

  socket.on('sendTestTwoOpponent', (data) => {
    if(!opponent) {
      opponent = testOpponentSockets[1][data.username];
      delete testOpponentSockets[1][data.username];
    }
    socket.emit('joinTestTwoEvent', data);
  });

   socket.on('findRoomEvent', (data) => {
      console.log(data.gameSettings);
      if(data.gameSettings.mode === 'test1' || data.gameSettings.mode === 'test2'){
        gameMode = data.gameSettings.mode;
      } else {
        gameMode = parseInt(data.gameSettings.mode)
      }
      timer = parseInt(data.gameSettings.timer);
      username = data.username;
      if (gameMode === 'test1') {
        if (testQueues[0].getLength() > 0) {
          opponent = testQueues[0].dequeue();
          testOpponentSockets[0][opponent.username] = {socket, username: data.username};
          image = setImages[imageIndex];
          getImage(image, (err, results) => {
            getHints(image, (hintslist) => {
              host = data.username;
              opponent.socket.emit('testOneJoinedEvent', {host, opponent: data.username, imageURL: results, timer, hints: hintslist, useHints: true});
              socket.emit('testOneJoinedEvent', {host, opponent: opponent.username, imageURL: results, timer, hints: hintslist, useHints: true});
            });
          });
        } else {
          testQueues[0].enqueue({socket: socket, username: data.username});
        }
      } else if (gameMode === 'test2') {
        hints = 0;
        if (testQueues[1].getLength() > 0) {
          opponent = testQueues[1].dequeue();
          testOpponentSockets[1][opponent.username] = {socket, username: data.username};
          image = setImages[imageIndex];
          getImage(image, (err, results) => {
              host = data.username;
              opponent.socket.emit('testTwoJoinedEvent', {host, opponent: data.username, imageURL: results, timer});
              socket.emit('testTwoJoinedEvent', {host, opponent: opponent.username, imageURL: results, timer});
          });
        } else {
          testQueues[1].enqueue({socket: socket, username: data.username});
        }
      } else if (gameMode === 2) {
        image = getRandomImageNumber();
        getImage(image, (err, results) => {
          getHints(image, (hintslist) => {
            let validWords = [];
            for (var word = 0; word < hintslist.length; word++) {
              if (!hintslist[word].includes(' ')) {
                validWords.push(hintslist[word]);
              }
            }
            hangmanWords = validWords;
            socket.emit("initialiseHangmanEvent", {image, imageURL: results, word: hangmanWords[0]});
          });
        });
      } else if (gameModeQueues[gameMode].getLength() > 0) {
        // if queue is not empty, dequeue, save as opponent and emit roomFoundEvent to opponent socket and this socket
         sessionRoomNumber = roomNumber;
         roomNumber++;
         opponent = gameModeQueues[gameMode].dequeue();
        opponentSockets[gameMode][opponent.username] = {socket: socket, username: data.username};
        image = getRandomImageNumber();
         getImage(image, (err, results) => {
           host = data.username;
           opponent.socket.emit('roomFoundEvent', {host: data.username, sessionRoomNumber: sessionRoomNumber, opponent: data.username, imageURL: results, timer});
           socket.emit('roomFoundEvent', {host: data.username, sessionRoomNumber: sessionRoomNumber, opponent: opponent.username, imageURL: results, timer});
         });
      // else queue this socket
      } else {
        gameModeQueues[gameMode].enqueue({socket: socket, username: data.username});
      }
   });
});

