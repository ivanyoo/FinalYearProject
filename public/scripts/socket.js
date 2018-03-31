//'http://phototagging.eu-west-1.elasticbeanstalk.com/'
const socket = io.connect('localhost');
let username;
let opponent;
let sessionRoomNumber;
let room;
let mode;
let host;
let wordsUsed = new Set();
let score = 0;
let timerMax = 90;
let timer;
let imageScore = 0;
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
  socket.emit('skipEvent', {username, numAnswers: wordsUsed.size, timer});
};

const skipHangmanWord = (word) => {
  socket.emit('skipHangmanWordEvent', {word});
};

const askForImage = () => {
  socket.emit('askForImageEvent', {numAnswers: wordsUsed.size, score: imageScore});
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

socket.on('roomFoundEvent', (data) => {
  host = data.host;
  socket.emit('joinRoomEvent', {roomNumber: data.sessionRoomNumber, username: username, imageURL: data.imageURL});
  sessionRoomNumber = data.sessionRoomNumber;
  opponent = data.opponent;
});

socket.on('joinTestOneEvent', data => {
  document.getElementById('lobbyContainer').style.display = 'none';
  room = ReactDOM.render(<Room/>,
    document.getElementById('game-container'));
  room.initialiseRoom(username, data.imageURL, data.timer, true, data.hints, data.useHints);
});

socket.on('joinTestTwoEvent', data => {
  document.getElementById('lobbyContainer').style.display = 'none';
  room = ReactDOM.render(<Room/>,
    document.getElementById('game-container'));
  room.initialiseRoom(username, data.imageURL, data.timer, true);
});

socket.on('testOneJoinedEvent', data => {
  host = data.host;
  opponent = data.opponent;
  data.username = username;
  socket.emit('sendTestOneOpponent', data);
});

socket.on('testTwoJoinedEvent', data => {
  host = data.host;
  opponent = data.opponent;
  data.username = username;
  socket.emit('sendTestTwoOpponent', data);
});

socket.on('initialiseHangmanEvent', (data) => {
  document.getElementById('lobbyContainer').style.display = 'none';
   room = ReactDOM.render(<Hangman/>,
    document.getElementById('game-container'));
  room.initialiseHangman(data);
});

socket.on('newImageEvent', (data) => {
  wordsUsed = new Set();
  imageScore = 0;
  room.getReadyForNewImage(data);
});

socket.on('sendHintEvent', (data) => {
  room.addHintWords(data.words);
});

socket.on('renderWaitEvent', (data) => {
  room.renderWaitForScore(data.answer);
});

socket.on('skipImageEvent', (data) => {
  wordsUsed = new Set();
  imageScore = 0;
  room.opponentSkip(data);
  if (data.username !== username) {
    socket.emit('updateImageIndexEvent');
  }
});

socket.on('scoreCalculatedEvent', (data) => {
  score += data.score;
  imageScore += data.score;
  room.updateCalculatedScore(data.score);
});

socket.on('verifiedAnswerEvent', (data) => {
  wordsUsed.add(data.answer);
  if (data.username === username) {
    room.addSubmittedWord(data.answer)
  } else {
    if (room.getSubmittedWords().includes(data.answer) && data.username === opponent) {
      socket.emit('answerMatchEvent', { answer: data.answer, timer: timerMax - timer });
    } else {
      socket.emit('opponentAnswerVerifiedEvent', data);
    }
  }
});

socket.on('finishTestEvent', () => {
  room = null;
  ReactDOM.unmountComponentAtNode(document.getElementById('game-container'));
  document.getElementById('game-container').innerHTML = '<div id="finishTest">Thank you for taking part in the test for our game. Your score this session is ' + score + '. Well done.</div>';
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

