const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);

server.listen(8081);
let userid = 1;

app.get('/', (req, res) => {
   userid++;
   res.sendFile(`${__dirname}/index.html`);
});

io.on('connection', (socket) => {
   socket.emit('news', {hello: 'world', id: userid});
   socket.on('my other event', (data) => {
      console.log(data);
   });

   socket.on('answerEvent', (data) => {
      console.log(`Player ${data.id} answered ${data.answer}`);
   });
});