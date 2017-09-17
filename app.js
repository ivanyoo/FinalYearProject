const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const Queue = require('./Queue.src');

server.listen(80);
let userid = 1;
let roomNumber = 1;
const playerQueue = new Queue();

app.get('/', (req, res) => {
   res.sendFile(`${__dirname}/index.html`);
});

io.on('connection', (socket) => {
   let sessionRoomNumber;
   let answers = [];

   socket.on(`answerEvent`, (data) => {
      answers.push(data.answer);
      io.to(`testroom-${sessionRoomNumber}`).emit('opponentAnswerEvent', {answer: data.answer});
   });

   socket.on('opponentAnswerEvent', (data) => {
      if (answers.includes(data.answer)) {
         io.to(`testroom-${sessionRoomNumber}`).emit('answerMatchEvent');
      }
   });

   socket.on('joinRoomEvent', (data) => {
      socket.join(`testroom-${data.roomNumber}`);
      socket.emit('roomJoinedEvent');
});

   socket.on('findRoomEvent', (data) => {
      userid++;
      if (playerQueue.getLength() > 0) {
         sessionRoomNumber = roomNumber;
         roomNumber++;
         playerQueue.dequeue().emit('roomFoundEvent', {sessionRoomNumber: sessionRoomNumber});
         socket.emit('roomFoundEvent', {sessionRoomNumber: sessionRoomNumber});
      } else {
         playerQueue.enqueue(socket);
      }
   });
});