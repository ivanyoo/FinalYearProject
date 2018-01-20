//'http://phototagging-env.t2np5kseqn.eu-west-1.elasticbeanstalk.com/'
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
    }
  }

  // sets username, initial Image URL and refreshes component
  initialiseRoom(username, imageURL) {
    console.log(imageURL);
    this.setState({ username, imageURL, submittedWords: [] });
  }

  // changes the imageURL in the state and resets submittedWords and adds score
  changeImage(imageURL) {
    this.setState({ imageURL, submittedWords: [], score: this.state.score += 100 });
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

  render() {
    return(
      <div>
        <div className="title">
          <span><b>Photo-tagging</b></span>
        </div>
        <div className="gameMode">
          Game Mode:  {this.getGameMode()}
        </div>
        <div className="username">
          Username: {this.state.username}
        </div>
        <div>
          Score: {this.state.score}
        </div>
        <br/>
        <div className="photo">
          <img src={this.state.imageURL} />
        </div>
        <br />
        <div>
          Submit words that describe the image:
        </div>
        <br />
        <div className="inputBox">
          <form  onSubmit={(event) => this.submitWord(event)}>
            <input id="inputBox" type="text" />
          </form>
        </div>
        <div>
          Your words so far:
          <br />
          {this.state.submittedWords.join(' ')}
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


// initialises React component and displays the game
socket.on('roomJoinedEvent', (data) => {
  document.getElementById('lobbyContainer').style.display = 'none';
  room = ReactDOM.render(<Room/>,
    document.getElementById('game-container'));
  room.initialiseRoom(username, data);
});

socket.on('roomFoundEvent', (data) => {
  socket.emit('joinRoomEvent', {roomNumber: data.sessionRoomNumber, username: username});
  sessionRoomNumber = data.sessionRoomNumber;
  opponent = data.opponent;
});

socket.on('newImageEvent', (data) => {
  room.changeImage(data);
});

socket.on('verifiedAnswerEvent', (data) => {
  console.log(data);
  if (data.username == username) {
    room.addSubmittedWord(data.answer)
  } else if (room.getSubmittedWords().includes(data.answer) && data.username === opponent) {
    socket.emit('answerMatchEvent', { answer: data.answer, points: 100 });
  }
});

socket.on('finishGameEvent', (data) => {
  console.log('!');
  document.getElementById('game').style.display = 'none';
  document.getElementById('result').style.display = 'block';
});

