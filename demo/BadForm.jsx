export default function BadForm() {
  const submit = () => console.log("submit");

  return (
    <form className="signup">
      <img src="/logo.svg" alt="Acme" />

      <h2>Create your account</h2>

      <label htmlFor="email">Email address</label>
      <input id="email" type="email" />

      <label htmlFor="password">Password</label>
      <input id="password" type="password" />

      <button type="button" onClick={submit} className="btn-primary">
        Create account
      </button>

      <a href="/terms">
        Read the terms
      </a>
    </form>
  );
}
