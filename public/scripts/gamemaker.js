class GameMaker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      timer: 90,
      mode: null,
      taboowords: false,
      noOfPlayers: 2
    }
  }

  changeMode(mode){
    if (mode !== this.state.mode) {
      this.setState({mode: mode}, this.submitForm);
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

  // First Version:
  // render() {
  //   return (<div id="lobby">
  //     <div>
  //       Game Mode:
  //       <br />
  //       <button className="btn btn-default" onClick={() => this.changeMode(0)}>Versus Mode</button>
  //       <button className="btn btn-default" onClick={() => this.changeMode(1)}>Adjectives only</button>
  //       <button className="btn btn-default" onClick={() => this.changeMode(2)}>Hangman</button>
  //       <br/>
  //     </div>
  //     <div>
  //       Timer:
  //       <input className="form-control" id="timer" type="number" value={this.state.timer} onChange={() => {this.changeTime()}} />
  //       <br />
  //     </div>
  //     <div>
  //       Taboo words:
  //       <input className="form-control" type="checkbox" id="taboowords" onChange={() => {this.changeTabooWords()}} />
  //       <br />
  //     </div>
  //     <div>
  //       Number of Players:
  //       <input className="form-control" id="numplayers" value={this.state.noOfPlayers} type="number" min="1" max="10" onChange={() => {this.changeNoOfPlayers()}}/>
  //       <br />
  //     </div>
  //     <div>
  //       <button className="btn btn-default" onClick={()=> {this.submitForm()}}>Submit</button>
  //     </div>
  //   </div>);
  // }

  render() {
    return (<div id="lobby">
      <div>
        Game Mode:
        <br />
        <button className="btn btn-default" onClick={() => this.changeMode(0)}>Versus Mode</button>
        <button className="btn btn-default" onClick={() => this.changeMode(2)}>Hangman</button>
        <br/>
      </div>
    </div>);
  }
}