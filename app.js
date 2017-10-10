const express = require('express');
const mysql = require('mysql');
const app = require('express')();
const path = require('path');
const server = require('http').Server(app);
const config = require('./config.json');
const io = require('socket.io')(server);
const Queue = require('./Queue.src');
server.listen(8081);
let userid = 1;
let roomNumber = 1;
const playerQueue = new Queue();
const opponentSockets = {};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
   res.send('root');
});

const getImage= (imageNumber, callback) => {
  const connection = mysql.createConnection(config.AWS_DB);
  connection.connect();
  connection.query('SELECT webformatURL, tags FROM pixabay_images WHERE id = ?', [imageNumber], (err, results) => {
     connection.end();
     if (err) {
        return callback(err);
     }
     callback(null, results[0]);
  });
};

io.on('connection', (socket) => {
   let sessionRoomNumber;
   let opponent;
   let image = 2;

   socket.on(`answerEvent`, (data) => {
      opponent.socket.emit('opponentAnswerEvent', {answer: data.answer, username: data.username});
      socket.emit('opponentAnswerEvent', {answer: data.answer, username: data.username});
   });

   socket.on('answerMatchEvent', (data) => {
      image++;
      getImage(image, (err, results) => {
         socket.emit('newImageEvent', results);
         opponent.socket.emit('newImageEvent', results);
      });
   });

   socket.on('joinRoomEvent', (data) => {
      socket.join(`testroom-${data.roomNumber}`);
      if (!opponent) {
         opponent = opponentSockets[data.username];
         delete opponentSockets[data.username];
      }
      getImage(image, (err, results) => {
        socket.emit('roomJoinedEvent', results);
      });
   });



   socket.on('findRoomEvent', (data) => {
      userid++;
      if (playerQueue.getLength() > 0) {
         sessionRoomNumber = roomNumber;
         roomNumber++;
         opponent = playerQueue.dequeue();
         opponentSockets[opponent.username] = {socket: socket, username: data.username};
         opponent.socket.emit('roomFoundEvent', {sessionRoomNumber: sessionRoomNumber, opponent: data.username});
         socket.emit('roomFoundEvent', {sessionRoomNumber: sessionRoomNumber, opponent: opponent.username});
      } else {
         playerQueue.enqueue({socket: socket, username: data.username});
      }
   });
});