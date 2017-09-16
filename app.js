const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);

server.listen(80);
let userid = 1;

app.get('/', (req, res) => {
   userid++;
   res.sendFile(`${__dirname}/index.html`);
});

io.on('connection', (socket) => {
   socket.on('answerEvent', (data) => {
      console.log(`Player ${data.id} answered ${data.answer}`);
      io.to('testroom').emit('roomevent');
   });

   socket.on('joinRoomEvent', () => {
      console.log('joined');
      socket.join('testroom');
   });
});