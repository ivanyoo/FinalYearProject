//'http://phototagging.eu-west-1.elasticbeanstalk.com/'
const socket = io.connect('localhost');
let username;
let opponent;
let sessionRoomNumber;
let room;
let mode;
let host;

const loginform = ReactDOM.render(<LoginForm/>, document.getElementById('joinRoom'));

// sends an answer event to main app
const answer = (result) => {
  if (room.getHintWords().indexOf(result) > -1) {
    room.hintWordAnswered();
  } else {
    socket.emit(`answerEvent`, {answer: result, username: username});
  }
};

const sendGameSettings = (gameSettings) => {
  ReactDOM.unmountComponentAtNode(document.getElementById('lobbyContainer'));
  document.getElementById('lobbyContainer').outerHTML = `<div id="lobbyContainer"}><p id="findingRoom"}>Finding Room</p></div>`;
  socket.emit('findRoomEvent', {username: username, gameSettings: gameSettings});
};

const askForHint = () => {
  socket.emit('askForHintEvent', username);
};

const joinRoom = () => {
  if (document.getElementById('username').value.length > 0) {
    username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    $.post('/login', {
      username: username,
      password: password
    }).done((result) => {
      if (result.error) {
        document.getElementById('login-message').outerHTML = `<p id="login-message"}>${result.error}</p>`;
      } else {
        document.getElementById('joinRoom').style.display = 'none';
        ReactDOM.render(<GameMaker/>, document.getElementById('lobbyContainer'));
      }
    });
  } else {
    document.getElementById('login-message').outerHTML = `<p id="login-message"}>Please enter a username and password</p>`;
  }
};

const newHangmanWord = (points, livesLeft, word) => {
  socket.emit('newHangmanWordEvent', {points, livesLeft, word});
};

const sendSkip = (username) => {
  socket.emit('skipEvent', username);
};

const askForImage = () => {
  socket.emit('askForImageEvent');
};

const newHangmanImage = () => {
  socket.emit('newHangmanImageEvent');
};

const returnToStart = () => {
  room = null;
  document.getElementById('lobbyContainer').style.display = 'inline';
  ReactDOM.unmountComponentAtNode(document.getElementById('game-container'));
  ReactDOM.render(<GameMaker/>, document.getElementById('lobbyContainer'));

};

// initialises React component and displays the game
socket.on('roomJoinedEvent', (data) => {
  document.getElementById('lobbyContainer').style.display = 'none';
  room = ReactDOM.render(<Room/>,
    document.getElementById('game-container'));
  room.initialiseRoom(username, data.imageURL, data.timer);
});

socket.on('initialiseHangmanEvent', (data) => {
  document.getElementById('lobbyContainer').style.display = 'none';
   room = ReactDOM.render(<Hangman/>,
    document.getElementById('game-container'));
  room.initialiseHangman(data);
});

socket.on('roomFoundEvent', (data) => {
  host = data.host;
  socket.emit('joinRoomEvent', {roomNumber: data.sessionRoomNumber, username: username, imageURL: data.imageURL});
  sessionRoomNumber = data.sessionRoomNumber;
  opponent = data.opponent;
});

socket.on('newImageEvent', (data) => {
  room.getReadyForNewImage(data);
});

socket.on('sendHintEvent', (data) => {
  room.addHintWords(data.words);
});

socket.on('renderWaitEvent', (data) => {
  room.renderWaitForScore(data.answer);
});

socket.on('skipImageEvent', (data) => {
  room.opponentSkip(data);
  if (data.username !== username) {
    socket.emit('opponentSkippedEvent');
  }
});

socket.on('scoreCalculatedEvent', (data) => {
  console.log(data.score);
  room.updateCalculatedScore(data.score);
});

socket.on('verifiedAnswerEvent', (data) => {
  console.log(data);
  if (data.username === username) {
    room.addSubmittedWord(data.answer)
  } else {
    if (room.getSubmittedWords().includes(data.answer) && data.username === opponent) {
      socket.emit('answerMatchEvent', { answer: data.answer});
    } else {
      socket.emit('opponentAnswerVerifiedEvent', data);
    }
  }
});

socket.on('sendNewHangmanWordEvent', (data) => {
  room.setNewWord(data.word);
});

socket.on('newHangmanImageEvent', (data) => {
  room.prepareForNewImage(data);
});

socket.on('finishGameEvent', (data) => {
  console.log('!');
  document.getElementById('game').style.display = 'none';
  document.getElementById('result').style.display = 'block';
});

