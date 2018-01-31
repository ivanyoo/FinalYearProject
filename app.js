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
  const min = 1;
  const max = 600;
  return Math.floor(Math.random() * (max - min)) + min;
};

// queries the database for url of image with id = imageNumber
const getImage= (imageNumber, callback) => {
  return callback(null, `https://s3-eu-west-1.amazonaws.com/114344211.photo-tagging/pixabay_images/${imageNumber}.jpg`);
};

const updateScore = (player, opponent, score, callback) => {
  const connection = mysql.createConnection(config.AWS_DB);
  connection.connect();
  connection.query('UPDATE users SET totalPoints = totalPoints + ? WHERE username IN (?, ?)',[score, player, opponent], (err, results) => {
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
   let image = 1;

   socket.on(`answerEvent`, (data) => {
      if (gameMode == 0) {
        wordpos.lookup(data.answer, (result, word) => {
          if (result.length > 0) {
            opponent.socket.emit('verifiedAnswerEvent', {answer: data.answer, username: data.username});
            socket.emit('verifiedAnswerEvent', {answer: data.answer, username: data.username});
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
      upsertOccurence(image, data.answer, (error) => {
        getScore(data.answer, (score) => {
          updateScore(username, opponent.username, score , (err) => {
            image = getRandomImageNumber();
            getImage(image, (err, results) => {
              socket.emit('newImageEvent', {imageURL: results, score: score});
              opponent.socket.emit('newImageEvent', {imageURL: results, score: score});
            });
          });
        });
      });
   });

   socket.on('joinRoomEvent', (data) => {
      socket.join(`testroom-${data.roomNumber}`);
      if (!opponent) {
         opponent = opponentSockets[gameMode][data.username];
         delete opponentSockets[gameMode][data.username];
      }
      getImage(image, (err, results) => {
        socket.emit('roomJoinedEvent', results);
      });
   });

   socket.on('findRoomEvent', (data) => {
      console.log(data.gameSettings);
      gameMode = parseInt(data.gameSettings.mode);
      username = data.username;
      // if queue is not empty, dequeue, save as opponent and emit roomFoundEvent to opponent socket and this socket
      if (gameModeQueues[gameMode].getLength() > 0) {
         sessionRoomNumber = roomNumber;
         roomNumber++;
         opponent = gameModeQueues[gameMode].dequeue();
         opponentSockets[gameMode][opponent.username] = {socket: socket, username: data.username};
         opponent.socket.emit('roomFoundEvent', {sessionRoomNumber: sessionRoomNumber, opponent: data.username});
         socket.emit('roomFoundEvent', {sessionRoomNumber: sessionRoomNumber, opponent: opponent.username});
      // else queue this socket
      } else {
        gameModeQueues[gameMode].enqueue({socket: socket, username: data.username});
      }
   });
});