const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const passwordHash = require('password-hash');
const path = require('path');
const WORDPOS = require('wordpos');
const config = require('./config.json');
const getScore = require('./dboperations');
const insertMatch = require('./insertMatch');
const insertImageMetric = require('./insertImageMetric');
const insertSkipMetric = require('./insertSkipMetric');
const stemmer = require('stemmer');
const getHints = require('./hints');
const wordpos = new WORDPOS();

const Queue = require('./Queue.src');
const gameModeQueues = [new Queue(), new Queue()];
const testQueues = [new Queue(), new Queue()];


const opponentSockets = [{},{}];
const testOpponentSockets = [{}, {}];
const maxTestImages = 20;

const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);
// expose port 8081 in EBS
server.listen(8081);
// use public as our main directory
app.use(express.static(path.join(__dirname, 'public')));
// use a parser for requests
app.use(bodyParser.urlencoded({ extended: false }));
// send root for get request
app.get('/', (req, res) => {
   res.send('root');
});

app.post('/login', (req, res) => {
  const connection = mysql.createConnection(config.AWS_DB);
  connection.connect();
  // get hashedpassword from db where username is the uesrname in the post request
  connection.query('SELECT hashedPassword FROM users WHERE username = ?', [req.body.username], (err, results) => {
    if (err) {
       console.log(err);
    }
    if (!results[0]) {
      // if there are no results it must be a new player
       connection.query('INSERT INTO users (username, hashedPassword) VALUES (?,?)',
         [req.body.username, passwordHash.generate(req.body.password)], (error) => {
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
         // if password is not verifiable then it must be the wrong password
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

// appends the imageNumber to the s3 bucket link to get image link
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
   let username;
   let opponent;
   let gameMode;
   let timer;
   let image = 1;
   let hints = 1;
   let words = [];
   let host;
   let opponentWords = [];
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
       // get an image number
       image = getRandomImageNumber();
       if (gameMode === 'test1' ||  gameMode === 'test2') {
         // if in test mode update image index
         imageIndex++;
         if (imageIndex <= setImages.length) {
           // if there are still images left in the set images use them
           // else use a random image
           image = setImages[imageIndex];
         }
         if (imageIndex > maxTestImages) {
           // finish the test once players have done the test images
           finishGame();
           return;
         }
       }
       // get the image url
       getImage(image, (err, results) => {
         if (gameMode === 'test1') {
           // if testing hints get the hints
           getHints(image, hintslist => {
             socket.emit('newImageEvent', {username, imageURL: results, hints: hintslist});
             opponent.socket.emit('newImageEvent', {username, imageURL: results, hints: hintslist});
           });
         } else {
           socket.emit('newImageEvent', {username, imageURL: results, hints: []});
           opponent.socket.emit('newImageEvent', {username, imageURL: results, hints: []});
         }
       });
     }
   };

   socket.on('askForImageEvent', (data) => {
     // image is finished
     // send new image and reset number of Matches
     // update Image metrics in db
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
         // dont include words that contain spaces
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
        // make sure answer is a word in wordNet
        wordpos.lookup(data.answer, (result) => {
          if (result.length > 0) {
            opponent.socket.emit('verifiedAnswerEvent', {answer: data.answer, username: data.username});
            socket.emit('verifiedAnswerEvent', {answer: data.answer, username: data.username});
          } else {
            // if not check if its stemmed Word is a word in wordnet
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
        // check if word is registered in wordNet as an adjective
        wordpos.isAdjective(data.answer, (result) => {
          if (result) {
            opponent.socket.emit('verifiedAnswerEvent', {answer: data.answer, username: data.username});
            socket.emit('verifiedAnswerEvent', {answer: data.answer, username: data.username});
          }
        });
      }
   });

   socket.on('updateNumMatchesEvent', data => {
     // update number of matches for this socket
     if (numMatches !== data.numMatches) {
       numMatches = data.numMatches;
     }
   });

   socket.on('answerMatchEvent', (data) => {
     numMatches++;
     socket.emit('renderWaitEvent', {answer: data.answer});
     opponent.socket.emit('renderWaitEvent', {answer: data.answer});
     // update occurences table in db with this answer
     upsertOccurence(image, data.answer, () => {
       // get the score for this word
        getScore(data.answer, (score) => {
          // update the scores of the players in the db
          updateScore(username, score , () => {
            updateScore(opponent.username, score, () => {
              // send the score to the clients
              socket.emit('scoreCalculatedEvent', {score: score, numMatches});
              opponent.socket.emit('scoreCalculatedEvent', {score: score, numMatches});
              let result = {word: data.answer, timeTaken: data.timer, score: score, hints: hints};
              // update the matches table in db
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
     // remove 50 points from player who pressed skip
     updateScore(data.username,  -50, (err) => {
       // reward player a small amount of points for not pressing skip
       updateScore(data.username === username ? opponent.username : username, 50, (err) => {
         // get a new image number
         image = getRandomImageNumber();
         if (gameMode === 'test1' ||  gameMode === 'test2') {
           //if in test update image index
           imageIndex++;
           if (imageIndex <= setImages.length) {
             // if index is less than the amount of set images use one of the set images
             image = setImages[imageIndex];
           }
           if (imageIndex > maxTestImages) {
             // finish the game if players have played the set amount of images
             finishGame();
             return;
           }
         }
         getImage(image, (err, results) => {
           if (gameMode === 'test1') {
             // if testing hints send the hints to the clients
             getHints(image, hintslist => {
               socket.emit('skipImageEvent', {username: data.username, imageURL: results, score: 50, hints: hintslist, numMatches: 0});
               opponent.socket.emit('skipImageEvent', {username: data.username, imageURL: results, score: 50, hints: hintslist, numMatches: 0});
             });
           } else {
             // send the new image and the points
             socket.emit('skipImageEvent', {username: data.username, imageURL: results,
               score: 50, hints: [], numMatches: 0});
             opponent.socket.emit('skipImageEvent', {username: data.username, imageURL: results,
               score: 50, hints: [], numMatches: 0});
           }
           // update skip table in db
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
       // retrieve hints from db
       getHints(image, (hintsList) => {
         // send hints to client
         socket.emit('sendHintEvent', {words: hintsList});
       });
     }
   });

   socket.on('newHangmanWordEvent', (data) => {
     hangmanIndex++;
     // give the user points for answering word
     updateScore(username, data.points, () => {
       // if there are no more words for this image
       if (hangmanIndex === hangmanWords.length) {
         // get a new image
         image = getRandomImageNumber();
         getImage(image, (err, results) => {
           // get the words for the image
           getHints(image, (hintslist) => {
             // validate words
             let validWords = [];
             for (let word = 0; word < hintslist.length; word++) {
               if (!hintslist[word].includes(' ')) {
                 validWords.push(hintslist[word]);
               }
             }
             hangmanWords = validWords;
             hangmanIndex = 0;
             // send new image
             socket.emit('newHangmanImageEvent', {image, imageURL: results, word: hangmanWords[hangmanIndex]});
           });
         });
       } else {
         // send new word
         socket.emit('sendNewHangmanWordEvent', {word: hangmanWords[hangmanIndex]});
       }
     });
   });

   socket.on('skipHangmanWordEvent', data => {
     hangmanIndex++;
     // remove points from player
     updateScore(username, -100, () => {
       // if there are no more words for this image
       if (hangmanIndex === hangmanWords.length) {
         // get a new image
         image = getRandomImageNumber();
         getImage(image, (err, results) => {
           // get the words
           getHints(image, (hintslist) => {
             // validate words
             let validWords = [];
             for (let word = 0; word < hintslist.length; word++) {
               if (!hintslist[word].includes(' ')) {
                 validWords.push(hintslist[word]);
               }
             }
             hangmanWords = validWords;
             hangmanIndex = 0;
             // send new image and word
             socket.emit('newHangmanImageEvent', {image, imageURL: results, word: hangmanWords[hangmanIndex]});
           });
         });
       } else {
         // send new word
         socket.emit('sendNewHangmanWordEvent', {word: hangmanWords[hangmanIndex]});
       }
     });
   });

  socket.on('joinRoomEvent', (data) => {
    // assign opponent to player
    if (!opponent) {
      // search for opponents username in opponentSockets dictionary
      // remove from dictionary
      opponent = opponentSockets[gameMode][data.username];
      delete opponentSockets[gameMode][data.username];
    }
    // send event to signify start of game
    socket.emit('roomJoinedEvent',{imageURL: data.imageURL, timer});
  });

  socket.on('sendTestOneOpponent', (data) => {
    // assign opponent to player
    if(!opponent) {
      opponent = testOpponentSockets[0][data.username];
      delete testOpponentSockets[0][data.username];
    }
    // send event to signify start of game
    socket.emit('joinTestOneEvent', data);
  });

  socket.on('sendTestTwoOpponent', (data) => {
    // assign opponent to player
    if(!opponent) {
      opponent = testOpponentSockets[1][data.username];
      delete testOpponentSockets[1][data.username];
    }
    // send event to signify start of game
    socket.emit('joinTestTwoEvent', data);
  });

   socket.on('findRoomEvent', (data) => {
      // store the game mode
      if(data.gameSettings.mode === 'test1' || data.gameSettings.mode === 'test2'){
        gameMode = data.gameSettings.mode;
      } else {
        gameMode = parseInt(data.gameSettings.mode)
      }
      timer = parseInt(data.gameSettings.timer);
      // store username
      username = data.username;
      if (gameMode === 'test1') {
        // if queue is not empty pair players
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
        // turn off hints for this test
        hints = 0;
        // if queue is not empty pair players
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
         opponent = gameModeQueues[gameMode].dequeue();
         // place own socket in sockets list so that opponent can connect to your socket
        opponentSockets[gameMode][opponent.username] = {socket: socket, username: data.username};
        // retrieve a random image number
        image = getRandomImageNumber();
          // get the link for that image
         getImage(image, (err, results) => {
           host = data.username;
           // send an event to opponent client and host client that they have matched with an opponent
           opponent.socket.emit('roomFoundEvent', {host: data.username, opponent: data.username, imageURL: results, timer});
           socket.emit('roomFoundEvent', {host: data.username, opponent: opponent.username, imageURL: results, timer});
         });
      // else queue this socket
      } else {
        gameModeQueues[gameMode].enqueue({socket: socket, username: data.username});
      }
   });
});

