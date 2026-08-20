import { useState, type FormEvent } from "react";
import { useAuthStore } from "../lib/authStore";
import { useNetworkStore } from "../lib/network";
import { Banner } from "../components/Banner";

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const loginPending = useAuthStore((s) => s.loginPending);
  const errorMessage = useAuthStore((s) => s.errorMessage);
  const isOnline = useNetworkStore((s) => s.isOnline);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password || loginPending) return;
    void login(email.trim(), password);
  }

  return (
    <div className="centered">
      <div className="card stack" style={{ width: "100%", maxWidth: 320 }}>
        <div className="stack" style={{ gap: 2, marginBottom: 6 }}>
          <h1 style={{ fontSize: 16, margin: 0, color: "var(--color-navy)" }}>Virtual Bridge PH</h1>
          <p className="muted" style={{ margin: 0 }}>
            Time Tracker — sign in with your VA account
          </p>
        </div>

        {!isOnline ? <Banner kind="warning">You're offline. Sign-in needs an internet connection.</Banner> : null}

        <form className="stack" onSubmit={handleSubmit}>
          <div className="stack" style={{ gap: 6 }}>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loginPending}
              required
            />
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loginPending}
              required
            />
          </div>

          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

          <button type="submit" className="btn btn-primary btn-block" disabled={loginPending || !isOnline}>
            {loginPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
