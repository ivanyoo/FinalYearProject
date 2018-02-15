//'http://phototagging.eu-west-1.elasticbeanstalk.com/'
const socket = io.connect('localhost');
let username;
let opponent;
let sessionRoomNumber;
let room;
let mode;
let host;

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
      timerLength: 90,
      timer: 90,
      interval: null,
      skipUser: '',
      showSkip: true,
      hint: {
        showButton: true,
        words: []
      }
    };
    this.checkSkip = this.checkSkip.bind(this);
    this.timer = this.timer.bind(this);
  }

  // sets username, initial Image URL and refreshes component
  initialiseRoom(username, imageURL, timer) {
    this.setState({ username, imageURL, submittedWords: [], timer, timerLength: timer }, () => { setTimeout(this.timer, 1000); } );
  }

  timer() {
    if (this.state.timer > 0) {
      this.setState({timer: this.state.timer - 1}, () => { setTimeout(this.timer, 1000); });
    } else {
      askForImage();
    }
  }

  getReadyForNewImage(data) {
    this.setState({renderWait: 'newImage', showSkip: false});
    setTimeout(() => {
      this.changeImage(data);
    }, 5000)
  }

  // changes the imageURL in the state and resets submittedWords and adds score
  changeImage(data) {
    let hint = {
      showButton: true,
      words: []
    };
    this.setState({renderWait: false, showSkip: true, timer: this.state.timerLength, imageURL: data.imageURL, hint,  submittedWords: []});
    setTimeout(this.timer, 1000);
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

  updateCalculatedScore(score) {
    this.setState({scoredPoints: score, renderWait: 'wait', score: this.state.score += score});
  }

  waitForScore(){
    if (this.state.renderWait == true) {
      return (<p>You matched with the word {this.state.matchedWord} <br/> Calculating your score now.</p>);
    } else if (this.state.renderWait == 'wait') {
      return (<p>You scored {this.state.scoredPoints} points with {this.state.matchedWord} <br/></p>);
    } else if (this.state.renderWait == 'skipOpponent') {
      return (<p>{this.state.skipUser} has chosen to skip this image. You gain 50 points.</p>);
    } else if (this.state.renderWait == 'skipMe') {
      return (<p>You chose to skip this image. You lose 50 points.</p>);
    } else if (this.state.renderWait == 'newImage') {
      return (<p>A new image will appear soon.</p>)
    } else {
      return '';
    }
  }

  renderForm() {
    if (this.state.renderWait != 'newImage') {
      return (<div className="inputBox">
        <form  onSubmit={(event) => this.submitWord(event)}>
          <input id="inputBox" className="form-control" type="text" />
        </form>
      </div>);
    } else {
      return '';
    }
  }

  opponentSkip(data) {
    let hint = {
      showButton: true,
      words: []
    };
    if (data.username === username) {
      this.setState({renderWait: 'skipMe', skipUser: data.username, score: this.state.score -= data.score, scoredPoints: data.score, hint});
    } else {
      this.setState({renderWait: 'skipOpponent', skipUser: data.username, score: this.state.score += data.score, scoredPoints: data.score, hint});
    }
    setTimeout(() => {this.getReadyForNewImage(data)}, 5000);
  }

  checkSkip() {
    sendSkip(username);
    this.setState({showSkip: false});
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
            <span>Time: {this.state.timer}</span>
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
          {this.state.showSkip ? <button onClick={this.checkSkip} id="skip" className="form-control">Skip word</button> : ''}
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

const sendSkip = (username) => {
  socket.emit('skipEvent', username);
};

const askForImage = () => {
  socket.emit('askForImageEvent');
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
});

socket.on('scoreCalculatedEvent', (data) => {
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

socket.on('finishGameEvent', (data) => {
  console.log('!');
  document.getElementById('game').style.display = 'none';
  document.getElementById('result').style.display = 'block';
});

