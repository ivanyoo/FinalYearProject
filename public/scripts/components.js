class Room extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      imageURL: '',
      submittedWords: [],
    }
  }

  changeImage(imageURL) {
    this.setState({ imageURL });
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

  render() {
    return(
      <div>
        <div className="title">
          <span><b>Photo-tagging</b></span>
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
          <input id="inputBox" type="text" />
        </div>
        <div>
          Your words so far:
          <br />
          {this.state.submittedWords}
        </div>
      </div>
    )
  }
}
