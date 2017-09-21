const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const Queue = require('./Queue.src');

server.listen(80);
let userid = 1;
let roomNumber = 1;
const playerQueue = new Queue();
const opponentSockets = {};

app.get('/', (req, res) => {
   res.sendFile(`${__dirname}/index.html`);
});

io.on('connection', (socket) => {
   let sessionRoomNumber;
   let opponent;

   socket.on(`answerEvent`, (data) => {
      opponent.socket.emit('opponentAnswerEvent', {answer: data.answer, username: data.username});
      socket.emit('opponentAnswerEvent', {answer: data.answer, username: data.username});
   });

   socket.on('answerMatchEvent', (data) => {
      socket.emit('finishGameEvent', {result: 1});
      opponent.socket.emit('finishGameEvent', {result: 1});
      console.log('finished');
   });

   socket.on('joinRoomEvent', (data) => {
      socket.join(`testroom-${data.roomNumber}`);
      if (!opponent) {
         opponent = opponentSockets[data.username];
         delete opponentSockets[data.username];
      }
      socket.emit('roomJoinedEvent');
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