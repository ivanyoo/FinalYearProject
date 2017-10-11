const socket = io.connect('http://phototagging-env.t2np5kseqn.eu-west-1.elasticbeanstalk.com/');
//'http://phototagging-env.t2np5kseqn.eu-west-1.elasticbeanstalk.com/'
let username;
let opponent;
let sessionRoomNumber;
let room;

class Room extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      username: '',
      imageURL: '',
      submittedWords: [],
    }
  }

  initialiseRoom(username, imageURL) {
    this.setState({ username, imageURL, submittedWords: [] });
  }

  changeImage(imageURL) {
    this.setState({ imageURL, submittedWords: [] });
  }

  getSubmittedWords() {
    return this.state.submittedWords;
  }

  addSubmittedWord(word) {
    let submittedWords = this.state.submittedWords;
    if (!submittedWords.includes(word)) {
      submittedWords.push(word);
      this.setState({ submittedWords });
    }
  }

  refreshSubmittedWords() {
    this.setState({ submittedWords: [] });
  }

  submitWord(event) {
    event.preventDefault();
    let word = document.getElementById('inputBox').value.toLowerCase();
    document.getElementById('inputBox').value = '';
    if(/^[a-zA-Z]+$/.test(word)) {
      answer(word);
    }
  }

  render() {
    return(
      <div>
        <div className="title">
          <span><b>Photo-tagging</b></span>
        </div>
        <div className="username">
          Username: {this.state.username}
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

socket.on('roomJoinedEvent', (data) => {
  console.log('Joined room');
document.getElementById('findRoom').style.display = 'none';
room = ReactDOM.render(<Room/>,
  document.getElementById('game-container'));
  console.log(data);
  room.initialiseRoom(username, data.webformatURL);
});

const answer = (result) => {
  console.log(sessionRoomNumber);
  room.addSubmittedWord(result);
  socket.emit(`answerEvent`, {answer: result, username: username});
};

socket.on('roomFoundEvent', (data) => {
  socket.emit('joinRoomEvent', {roomNumber: data.sessionRoomNumber, username: username});
sessionRoomNumber = data.sessionRoomNumber;
opponent = data.opponent;
});

socket.on('newImageEvent', (data) => {
  room.changeImage(data.webformatURL);
});

socket.on('opponentAnswerEvent', (data) => {
  console.log(data);
if (room.getSubmittedWords().includes(data.answer) && data.username === opponent) {
  socket.emit('answerMatchEvent');
}
});

socket.on('finishGameEvent', (data) => {
  console.log('!');
document.getElementById('game').style.display = 'none';
document.getElementById('result').style.display = 'block';
});

const joinRoom = () => {
  document.getElementById('joinRoom').style.display = 'none';
  document.getElementById('findRoom').style.display = 'block';
  username = document.getElementById('username').value;
  socket.emit('findRoomEvent', {username: username});
};