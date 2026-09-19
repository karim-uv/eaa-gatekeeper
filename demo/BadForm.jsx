export default function BadForm() {
  const submit = () => console.log("submit");

  return (
    <form className="signup">
      <img src="/logo.svg" />

      <h2></h2>

      <label>Email address</label>
      <input id="email" type="email" autoFocus />

      <label htmlFor="password">Password</label>
      <input id="password" type="password" />

      <div onClick={submit} className="btn-primary">
        Create account
      </div>

      <a href="#" onClick={submit}>
        Read the terms
      </a>
    </form>
  );
}
