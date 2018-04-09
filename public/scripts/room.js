class Room extends React.Component {
  constructor(props) {
    // store display items in component's state
    super(props);
    this.state = {
      username: '',
      imageURL: '',
      submittedWords: [],
      score: 0,
      renderWait: false,
      matchedWord: '',
      timerLength: 60,
      timer: 60,
      interval: null,
      skipUser: '',
      showSkip: true,
      hintAnswered: false,
      hint: {
        showButton: true,
        words: []
      }
    };
    // bind functions that refer to the component to itself
    this.checkSkip = this.checkSkip.bind(this);
    this.timer = this.timer.bind(this);
  }

  // sets initial variables such as imageURL etc
  initialiseRoom(username, imageURL, timer, test = false, hints = null, useHints = false) {
    let hint = {showButton: true, words: []};
    // don't show hint button during tests
    if (test) {
      hint.showButton = false;
    }
    // if given hints display them
    if (hints !== null) {
      hint.words = hints;
    }
    // update component's state
    this.setState({ username, imageURL, submittedWords: [], timer, timerLength: timer, test, useHints, hint }, () => { setTimeout(this.timer, 1000); } );
  }

  getHintWords() {
    return this.state.hint.words;
  }

  hintWordAnswered() {
    this.setState({hintAnswered: true});
  }

  timer() {
    if (this.state.timer > 0) {
      timer = this.state.timer;
      this.setState({timer: this.state.timer - 1}, () => { setTimeout(this.timer, 1000); });
    }  else if (this.state.timer < 0 && this.state.skipUser.length >= 1) {
      return null;
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

  // changes the imageURL in the state and resets submittedWords and hints
  changeImage(data) {
    let hint = {
      showButton: true,
      words: []
    };
    if (this.state.test){
      hint.showButton = false;
      hint.words = data.hints;
    }
    this.setState({renderWait: false, showSkip: true, hintAnswered: false,timer: this.state.timerLength,
      imageURL: data.imageURL, hint,  submittedWords: []});
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
      let submittedWords = this.state.submittedWords;
      if (!submittedWords.includes(word)) {
        answer(word);
      }
    }
  }

  getGameMode() {
    if (mode === 1) {
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
    if (this.state.renderWait === true) {
      return (<p>You matched with the word {this.state.matchedWord} <br/> Calculating your score now.</p>);
    } else if (this.state.renderWait === 'wait') {
      return (<p>You scored {this.state.scoredPoints} points with {this.state.matchedWord} <br/></p>);
    } else if (this.state.renderWait === 'skipOpponent') {
      return (<p>{this.state.skipUser} has chosen to skip this image. You gain 50 points.</p>);
    } else if (this.state.renderWait === 'skipSelf') {
      return (<p>You chose to skip this image. You lose 50 points.</p>);
    } else if (this.state.renderWait === 'newImage') {
      return (<p>A new image will appear soon.</p>)
    } else {
      return '';
    }
  }

  renderForm() {
    if (this.state.renderWait !== 'newImage') {
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
    if (this.state.test){
      hint.showButton = false;
    }
    // checks if you or opponent skipped
    if (data.username === username) {
      this.setState({renderWait: 'skipSelf', skipUser: data.username, timer: -1,
        score: this.state.score -= data.score, scoredPoints: data.score, hint,showSkip: false});
    } else {
      this.setState({renderWait: 'skipOpponent', skipUser: data.username, timer: -1,
        score: this.state.score += data.score, scoredPoints: data.score, hint, showSkip: false});
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
        let width = word.length * 10 + "px";
        let divWidth = 20 + word.length * 10 + "px";
        return (<div style={{width: divWidth}} className="word"><p style={{width: width, margin: "auto"}}>{word}</p></div>);
      })}
      <br/>
      {this.state.hintAnswered && <p>You cannot use hints as answers!</p>}
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
            {this.state.renderWait === false ? <p id="submitText">Submit words that describe the image:</p> : <p id="submitText" />}
          </div>
          <br />
          {this.renderForm()}
          {this.state.showSkip ? <button onClick={this.checkSkip} id="skip" className="form-control">Skip Image</button> : ''}
          {this.state.hint.showButton ? <button onClick={askForHint} id="skip" className="form-control">Ask for a hint</button> : ''}
          <br/>
        </div>
        <div id="wordsContainer">
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