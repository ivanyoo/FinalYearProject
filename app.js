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
const Queue = require('./Queue.src');
const stemmer = require('stemmer');
const getHints = require('./hints');
const wordpos = new WORDPOS();
server.listen(80);
let userid = 1;
let roomNumber = 1;
const gameModeQueues = [new Queue(), new Queue()];
const opponentSockets = [{},{}];

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
  const min = 2;
  const max = 600;
  return Math.floor(Math.random() * (max - min)) + min;
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
   let words = [];
   let host;
   let opponentWords = [];
   let offsettedScore = 0;

   const sendNewImage = () => {
     if (host === username) {
       image = getRandomImageNumber();
       getImage(image, (err, results) => {
         console.log(offsettedScore);
         socket.emit('newImageEvent', {imageURL: results, score: offsettedScore});
         opponent.socket.emit('newImageEvent', {imageURL: results, score: offsettedScore});
         offsettedScore = 0;
       });
     }
   };

   socket.on('askForImageEvent', () => {
     sendNewImage();
   });

   socket.on(`answerEvent`, (data) => {
      if (gameMode == 0) {
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
      } else if (gameMode == 1) {
        wordpos.isAdjective(data.answer, (result, word) => {
          if (result) {
            opponent.socket.emit('verifiedAnswerEvent', {answer: data.answer, username: data.username});
            socket.emit('verifiedAnswerEvent', {answer: data.answer, username: data.username});
          }
        });
      }
   });

   socket.on('answerMatchEvent', (data) => {
     socket.emit('renderWaitEvent', {answer: data.answer});
     opponent.socket.emit('renderWaitEvent', {answer: data.answer});
     upsertOccurence(image, data.answer, (error) => {
        getScore(data.answer, (score) => {
          offsettedScore += score;
          updateScore(username, offsettedScore , (err) => {
            updateScore(opponent.username, offsettedScore, (err) => {
              console.log(offsettedScore);
              socket.emit('scoreCalculatedEvent', {score: offsettedScore});
              opponent.socket.emit('scoreCalculatedEvent', {score: offsettedScore});
            });
          });
        });
      });
   });

   socket.on('joinRoomEvent', (data) => {
      if (!opponent) {
         opponent = opponentSockets[gameMode][data.username];
         delete opponentSockets[gameMode][data.username];
      }
      socket.emit('roomJoinedEvent',{imageURL: data.imageURL, timer});
   });

   socket.on('skipEvent', (data) => {
     offsettedScore = 0;
     updateScore(data,  -50, (err) => {
       updateScore(data == username ? opponent.username : username, 50, (err) => {
         image = getRandomImageNumber();
         getImage(image, (err, results) => {
           socket.emit('skipImageEvent', {username: data, imageURL: results, score: 50});
           opponent.socket.emit('skipImageEvent', {username: data, imageURL: results, score: 50});
         });
       });
     });
   });

   socket.on('opponentSkippedEvent', () => {
     offsettedScore = 0;
   });

   socket.on('askForHintEvent', (data) => {
     offsettedScore = -50;
     if (data === username){
       getHints(image, (hintsList) => {
         socket.emit('sendHintEvent', {words: hintsList});
       });
     }
   });

   socket.on('findRoomEvent', (data) => {
      console.log(data.gameSettings);
      gameMode = parseInt(data.gameSettings.mode);
      timer = parseInt(data.gameSettings.timer);
      username = data.username;
      // if queue is not empty, dequeue, save as opponent and emit roomFoundEvent to opponent socket and this socket
      if (gameModeQueues[gameMode].getLength() > 0) {
         sessionRoomNumber = roomNumber;
         roomNumber++;
         opponent = gameModeQueues[gameMode].dequeue();
         opponentSockets[gameMode][opponent.username] = {socket: socket, username: data.username};
         image = getRandomImageNumber();
         getImage(image, (err, results) => {
           host = data.username;
           opponent.socket.emit('roomFoundEvent', {host: data.username, sessionRoomNumber: sessionRoomNumber, opponent: data.username, imageURL: results});
           socket.emit('roomFoundEvent', {host: data.username, sessionRoomNumber: sessionRoomNumber, opponent: opponent.username, imageURL: results});
         });
      // else queue this socket
      } else {
        gameModeQueues[gameMode].enqueue({socket: socket, username: data.username});
      }
   });
});