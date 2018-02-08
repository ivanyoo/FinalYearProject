//'http://phototagging.eu-west-1.elasticbeanstalk.com/'
const socket = io.connect('localhost');
let username;
let opponent;
let sessionRoomNumber;
let room;
let mode;

class Room extends React.Component {
  constructor(props) {
    // store username, imageURL and submittedWords in component's state
    super(props);
    this.state = {
      username: '',
      imageURL: '',
      submittedWords: [],
      score: 0,
      renderWait: false,
      matchedWord: '',
      timer: 5,
      interval: null,
      opponentSkip: false,
      hint: {
        showButton: false,
        viewedHint: false,
        words: []
      }
    };
    this.timer = this.timer.bind(this);
    this.checkSkip = this.checkSkip.bind(this);
  }

  // sets username, initial Image URL and refreshes component
  initialiseRoom(username, imageURL) {
    console.log(imageURL);
    this.setState({ username, imageURL, submittedWords: [] });
  }

  timer() {
    if (this.state.timer > 0) {
      this.setState({timer: this.state.timer - 1});
      setTimeout(room.timer, 1000);
    } else {
      this.setState({renderWait: false, imageURL: this.state.data.imageURL, submittedWords: [] });
    }
  }

  // changes the imageURL in the state and resets submittedWords and adds score
  changeImage(data) {
    let hint = {
      showButton: false,
      viewedHint: false,
      words: []
    };
    this.setState({renderWait: 'wait', timer: 5, data: data, score: this.state.score += data.score, scoredPoints: data.score, hint});
    setTimeout(this.timer, 1000);
  }

  changeImageWithoutScore(data) {
    let hint = {
      showButton: false,
      viewedHint: false,
      words: []
    };
    this.setState({submittedWords: [], imageURL: data.imageURL, opponentSkip: false, renderWait: false, hint});
  }

  getSubmittedWords() {
    return this.state.submittedWords;
  }

  // adds word to submittedWords in state
  addSubmittedWord(word) {
    let submittedWords = this.state.submittedWords;
    if (!submittedWords.includes(word)) {
      submittedWords.push(word);
      this.setState({ submittedWords });
    }
  }

  // checks if user input only contains letters and calls answer
  submitWord(event) {
    event.preventDefault();
    let word = document.getElementById('inputBox').value.toLowerCase();
    document.getElementById('inputBox').value = '';
    if(/^[a-zA-Z]+$/.test(word)) {
      answer(word);
    }
  }

  getGameMode() {
    if (mode == 1) {
      return 'Adjectives Only';
    }
    return 'Classic';
  }

  getSubmittedWordsList() {
    return <div>
      {this.state.submittedWords.map((word) => {
        var width = word.length * 10 + "px";
        var divWidth = 20 + word.length * 10 + "px";
        return (<div style={{width: divWidth}} className="word"><p style={{width: width, margin: "auto"}}>{word}</p></div>);
      })}
    </div>;
  }

  renderWaitForScore(word) {
    this.setState({matchedWord: word, renderWait: true});
  }

  waitForScore(){
    if (this.state.renderWait == true) {
      return (<p>You matched with the word {this.state.matchedWord} <br/> Please wait while we calculate your score.</p>);
    } else if (this.state.renderWait == 'wait') {
      return (<p>You scored {this.state.scoredPoints} points with {this.state.matchedWord} <br/> A new image will appear in {this.state.timer} seconds.</p>);
    } else {
      return '';
    }
  }

  renderForm() {
    if (this.state.renderWait == false) {
      return (<div className="inputBox">
        <form  onSubmit={(event) => this.submitWord(event)}>
          <input id="inputBox" className="form-control" type="text" />
        </form>
      </div>);
    } else {
      return '';
    }
  }

  opponentHasSkipped() {
    this.setState({opponentSkip: true});
  }

  opponentSkip() {
    if (this.state.opponentSkip) {
      return (<p id="skipWords">Opponent wants to skip this word</p>);
    } else {
      return '';
    }
  }

  checkSkip() {
    if (this.state.opponentSkip) {
      bothSkipped();
    } else {
      sendOneSkip(username)
    }
  }

  showHintButton() {
    let hint = this.state.hint;
    hint.showButton = true;
    this.setState({hint});
  }

  addHintWords(words) {
    let hint = this.state.hint;
    hint.words = words;
    hint.showButton = false;
    this.setState({hint});
  }

  showHint() {
    return <div>
      {this.state.hint.words.map((word) => {
        var width = word.length * 10 + "px";
        var divWidth = 20 + word.length * 10 + "px";
        return (<div style={{width: divWidth}} className="word"><p style={{width: width, margin: "auto"}}>{word}</p></div>);
      })}
    </div>;
  }

  render() {
    return(
      <div>
        <div id="game">
          <div id="waitForScore">
            {this.waitForScore()}
            </div>
          <div id="description">
            <span>Game Mode:  {this.getGameMode()}</span>
            <span>Username: {this.state.username}</span>
            <span>Score: {this.state.score}</span>
          </div>
          <div id="photoContainer">
            <img id="photo" src={this.state.imageURL} />
          </div>
          <br />
          <div>
            {this.state.renderWait == false ? <p id="submitText">Submit words that describe the image:</p> : <p id="submitText"></p>}
          </div>
          <br />
          {this.renderForm()}
          <button onClick={this.checkSkip} id="skip" className="form-control">Skip word</button>
          {this.state.hint.showButton ? <button onClick={askForHint} id="skip" className="form-control">Ask for a hint</button> : ''}
          <br/>
        </div>
        <div>
          <div>
            <span id="current-words">Your words so far: </span>
            <br />
            {this.getSubmittedWordsList()}
          </div>
        </div>
        <div id="hintsContainer">
          {this.state.hint.words.length > 0 ? <p id="hints-title">Hints:</p> : ''}
          <br/>
          {this.showHint()}
        </div>
        {this.opponentSkip()}
      </div>
    )
  }
}

class GameMaker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      timer: 90,
      mode: 0,
      taboowords: false,
      noOfPlayers: 2
    }
  }

  changeMode(mode){
    if (mode !== this.state.mode) {
      this.setState({mode: mode});
    }
  }

  changeTime(){
    this.setState({timer: document.getElementById('timer').value});
  }

  changeTabooWords() {
    this.setState({taboowords: !this.state.taboowords});
  }

  changeNoOfPlayers() {
    this.setState({noOfPlayers: document.getElementById('numplayers').value});
  }

  submitForm() {
    sendGameSettings(this.state);
  }

  render() {
    return (<div id="lobby">
      <div>
        Game Mode:
        <br />
        <button className="btn btn-default" onClick={() => this.changeMode(0)}>Classic</button>
        <button className="btn btn-default" onClick={() => this.changeMode(1)}>Adjectives only</button>
        <br/>
      </div>
      <div>
        Timer:
        <input className="form-control" id="timer" type="number" value={this.state.timer} onChange={() => {this.changeTime()}} />
        <br />
      </div>
      <div>
        Taboo words:
        <input className="form-control" type="checkbox" id="taboowords" onChange={() => {this.changeTabooWords()}} />
        <br />
      </div>
      <div>
        Number of Players:
        <input className="form-control" id="numplayers" value={this.state.noOfPlayers} type="number" min="1" max="10" onChange={() => {this.changeNoOfPlayers()}}/>
        <br />
      </div>
      <div>
        <button className="btn btn-default" onClick={()=> {this.submitForm()}}>Submit</button>
      </div>
    </div>);
  }
}


class LoginForm extends React.Component {
  submitForm(event) {
    event.preventDefault();
    joinRoom();
  }

  render() {
    return (<div>
      <form onSubmit={this.submitForm}>
        <p>Username: </p>
        <input type="text" className="form-control" id="username" />
      <br/>
        <p>Password: </p>
        <input type="password" className="form-control" id="password" />
      <br/>
      <input type="submit"  className="btn btn-default" value="Login / Register"/>
      </form>
      <p id="login-message"></p>
    </div>);
  }
}

const loginform = ReactDOM.render(<LoginForm/>, document.getElementById('joinRoom'));

// sends an answer event to main app
const answer = (result) => {
  socket.emit(`answerEvent`, {answer: result, username: username});
};

const sendGameSettings = (gameSettings) => {
  document.getElementById('lobbyContainer').outerHTML = `<p id="lobbyContainer"}>Finding Room</p>`;
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

const sendOneSkip = (username) => {
  socket.emit('oneSkipEvent', username);
};

const bothSkipped = () => {
  socket.emit('bothSkippedEvent');
};


// initialises React component and displays the game
socket.on('roomJoinedEvent', (data) => {
  document.getElementById('lobbyContainer').style.display = 'none';
  room = ReactDOM.render(<Room/>,
    document.getElementById('game-container'));
  room.initialiseRoom(username, data);
});

socket.on('roomFoundEvent', (data) => {
  socket.emit('joinRoomEvent', {roomNumber: data.sessionRoomNumber, username: username, imageURL: data.imageURL});
  sessionRoomNumber = data.sessionRoomNumber;
  opponent = data.opponent;
});

socket.on('newImageEvent', (data) => {
  room.changeImage(data);
});

socket.on('sendHintEvent', (data) => {
  room.addHintWords(data.words);
});

socket.on('renderWaitEvent', (data) => {
  room.renderWaitForScore(data.answer);
});

socket.on('opponentHasSkippedEvent', (data) => {
  if (data != username) {
    room.opponentHasSkipped();
  }
});

socket.on('skipImageEvent', (data) => {
  room.changeImageWithoutScore(data);
});

socket.on('verifiedAnswerEvent', (data) => {
  console.log(data);
  if (data.username == username) {
    room.addSubmittedWord(data.answer)
  } else {
    if (room.getSubmittedWords().includes(data.answer) && data.username === opponent) {
      socket.emit('answerMatchEvent', { answer: data.answer});
    } else {
      room.showHintButton();
      socket.emit('opponentAnswerVerifiedEvent', data);
    }
  }
});

socket.on('finishGameEvent', (data) => {
  console.log('!');
  document.getElementById('game').style.display = 'none';
  document.getElementById('result').style.display = 'block';
});

