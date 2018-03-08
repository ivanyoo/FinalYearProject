class Hangman extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      livesCount: 10,
      image: null,
      imageURL: '',
      word: '',
      revealedLetters: [],
      guessedWord: '',
      lives: 10,
      renderWait: false,
      info: '',
      showExit: false,
      score: 0
    }
  }

  initialiseHangman(data) {
    let guessedWord = '';
    for (let index = 0; index < data.word.length; index++) {
      guessedWord += '_';
    }
    this.setState({guessedWord, word: data.word, image: data.image, imageURL: data.imageURL});
  }

  submitLetter(event) {
    event.preventDefault();
    let letter = document.getElementById('inputBox').value.toLowerCase();
    document.getElementById('inputBox').value = '';
    if (letter.length === 1 && letter.match(/[a-zA-z]/i) && this.state.revealedLetters.indexOf(letter) === -1) {
      let revealedLetters = this.state.revealedLetters;
      revealedLetters.push(letter);
      revealedLetters.sort();
      if (this.state.word.indexOf(letter) > -1) {
        let indexes = this.state.word.split('').reduce((output, element, index) => {
          if (element === letter) {
            output.push(index);
          }
          return output;
        }, []);
        let guessedWord = this.state.guessedWord.split('');
        for (let index = 0; index < indexes.length; index++) {
          guessedWord[indexes[index]] = letter;
        }
        guessedWord = guessedWord.join('');
        if (guessedWord.indexOf("_") > -1 ){
          this.setState({guessedWord});
        } else {
          this.wordFilled();
        }
      } else {
        let lives = this.state.lives - 1;
        if (lives <= 0) {
          this.setState({info: 'You have no more lives. You scored a total of ' + this.state.score + ' points', renderWait: true, showExit: true});
        } else {
          this.setState({lives: this.state.lives - 1});
        }
      }
    }
  }

  calculatePoints() {
    return (1000 - ((this.state.livesCount - this.state.lives) * 100)) + (this.state.word.length * 10);
  }

  setNewImage(data) {
    let guessedWord = '';
    for (let index = 0; index < data.word.length; index++) {
      guessedWord += '_';
    }
    this.setState({guessedWord, showExit: false, word: data.word, image: data.image, info: '', imageURL: data.imageURL, revealedLetters:[], renderWait: false, lives: this.state.livesCount});
  }

  prepareForNewImage(data) {
    let info = "You have guessed all of this image's words. A new image will appear soon";
    if (data.showExit) info = 'A new image will be loaded up soon. Your score has been reset';
    this.setState({info, renderWait: true});
    setTimeout(() => {
      this.setNewImage(data);
    }, 5000);
  }

  setNewWord(word) {
    let guessedWord = '';
    for (let index = 0; index < word.length; index++) {
      guessedWord += '_';
    }
    setTimeout(() => {
      this.setState({word, guessedWord, lives: this.state.livesCount, revealedLetters: [], renderWait: false, info: ''});
    }, 3000);
  }

  wordFilled() {
    let points = this.calculatePoints();
    let info = 'You have successfully matched all the letters. A new word will appear soon. You scored' + points + 'points.';
    newHangmanWord(points, this.state.lives, this.state.word);
    this.setState({guessedWord: this.state.word, info, renderWait: true, score: this.state.score + points});
  }

  renderForm() {
    if (!this.state.renderWait) {
      return (<div className="inputBox">
        <form  onSubmit={(event) => this.submitLetter(event)}>
          <input id="inputBox" className="form-control" type="text" />
        </form>
      </div>);
    } else {
      return '';
    }
  }

  resetGame() {
    let info = 'A new image will be loaded up soon. Your score has been reset';
    this.setState({info, score: 0, imageURL: null, word: ''});
    newHangmanImage();
  }

  renderButtons() {
    return (<div>
      <button className="btn btn-default" onClick={() => this.resetGame()}>Play again</button>
      <button className="btn btn-default" onClick={() => returnToStart()}>Return to menu</button>
    </div>)
  }

  render() {
    return(
      <div>
        <div id="game">
          <h1>Hangman Mode</h1>
          <p id="info">{this.state.info}</p>
          <div id="photoContainer">
            {this.state.imageURL != null && <img id="photo" src={this.state.imageURL} />}
          </div>
          <p id="lives">Lives: {this.state.lives} Score: {this.state.score}</p>
          <br />
          {!this.state.showExit && <p id="hangmanWord">{this.state.guessedWord}</p>}
          {!this.state.showExit && this.renderForm()}
          {!this.state.showExit && <p >Letters used: <p id="usedLetters">{this.state.revealedLetters}</p></p>}
          {this.state.showExit && this.renderButtons()}
            </div>
      </div>
    );
  }
}