class LoginForm extends React.Component {
  submitForm(event) {
    event.preventDefault();
    login();
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
