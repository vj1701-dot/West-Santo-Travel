"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const isSignUp = mode === "sign-up";

  function getCallbackURL() {
    return new URLSearchParams(window.location.search).get("callbackUrl") ?? "/";
  }

  async function handleGoogle() {
    const callbackURL = getCallbackURL();
    setIsPending(true);
    setMessage(null);

    const result = isSignUp
      ? await authClient.signIn.social({
          provider: "google",
          callbackURL,
          newUserCallbackURL: callbackURL,
          disableRedirect: false,
        })
      : await authClient.signIn.social({
          provider: "google",
          callbackURL,
          disableRedirect: false,
        });

    if (result.error) {
      setMessage(result.error.message ?? "Google authentication failed.");
      setIsPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const callbackURL = getCallbackURL();
    setIsPending(true);
    setMessage(null);

    const result = isSignUp
      ? await authClient.signUp.email({
          name: fullName.trim(),
          email,
          password,
          callbackURL,
        })
      : await authClient.signIn.email({
          email,
          password,
          callbackURL,
        });

    if (result.error) {
      setMessage(result.error.message ?? "Authentication failed.");
      setIsPending(false);
      return;
    }

    window.location.href = callbackURL;
  }

  return (
    <div className="panel auth-form-panel" style={{ maxWidth: "480px", margin: "4rem auto" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{isSignUp ? "Create Account" : "Sign In"}</h1>
      <p className="notes" style={{ marginBottom: "1rem" }}>
        {isSignUp ? "Use Google or email/password to create your account." : "Sign in with Google or your email/password."}
      </p>

      <div className="stack" style={{ gap: "0.75rem" }}>
        <form className="stack" onSubmit={handleSubmit}>
          {isSignUp ? (
            <label className="field">
              <span>Full name</span>
              <input onChange={(event) => setFullName(event.target.value)} required value={fullName} />
            </label>
          ) : null}

          <label className="field">
            <span>Email</span>
            <input onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>

          <label className="field">
            <span>Password</span>
            <input minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>

          <button className="auth-button" disabled={isPending} type="submit">
            {isPending ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        <button className="auth-button auth-button--google" disabled={isPending} onClick={() => void handleGoogle()} type="button">
          <GoogleIcon />
          <span>{isSignUp ? "Sign up with Google" : "Sign in with Google"}</span>
        </button>

        <p className="notes">
          {isSignUp ? "Already have an account?" : "Don’t have an account?"}{" "}
          <Link className="auth-switch-link" href={isSignUp ? "/sign-in" : "/sign-up"}>
            {isSignUp ? "Sign in" : "Sign up"}
          </Link>
        </p>

        {message ? <p className="notes">{message}</p> : null}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" focusable="false" height="18" viewBox="0 0 48 48" width="18">
      <path
        d="M24 9.5c3.36 0 6.39 1.16 8.77 3.08l6.54-6.54C35.4 2.6 30.03.5 24 .5 14.84.5 6.95 5.74 3.14 13.37l7.63 5.92C12.6 13.39 17.84 9.5 24 9.5z"
        fill="#EA4335"
      />
      <path
        d="M46.5 24.5c0-1.57-.14-3.08-.4-4.55H24v8.62h12.66c-.55 2.93-2.2 5.42-4.7 7.1l7.22 5.61C43.31 37.64 46.5 31.68 46.5 24.5z"
        fill="#4285F4"
      />
      <path
        d="M10.77 28.71A14.42 14.42 0 0 1 9.95 24c0-1.64.29-3.23.82-4.71l-7.63-5.92A23.45 23.45 0 0 0 .5 24c0 3.78.91 7.36 2.64 10.63l7.63-5.92z"
        fill="#FBBC05"
      />
      <path
        d="M24 47.5c6.03 0 11.1-1.99 14.8-5.4l-7.22-5.61c-2 1.35-4.56 2.16-7.58 2.16-6.16 0-11.4-3.89-13.23-9.29l-7.63 5.92C6.95 42.26 14.84 47.5 24 47.5z"
        fill="#34A853"
      />
    </svg>
  );
}
