"use client";

import Link from "next/link";
import { FormEvent, type MouseEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const isSignUp = mode === "sign-up";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setIsPending(true);

    try {
      if (isSignUp) {
        await authClient.signUp.email(
          { email, password, name: fullName },
          {
            onSuccess: () => {
              (window.location as any) = "/";
            },
            onError: (ctx) => {
              setMessage(ctx.error.message ?? "Sign up failed");
            },
          }
        );
      } else {
        await authClient.signIn.email(
          { email, password, rememberMe },
          {
            onSuccess: () => {
              (window.location as any) = "/";
            },
            onError: (ctx) => {
              setMessage(ctx.error.message ?? "Sign in failed");
            },
          }
        );
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.12)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.18)",
        borderRadius: "8px",
        padding: "2.5rem",
        maxWidth: "440px",
        width: "100%",
        boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.2)",
        transition: "all 0.3s ease",
      }}
    >
      {/* heading */}
      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: "600",
          marginBottom: "2rem",
          textAlign: "center",
          color: "white",
          fontStyle: "italic",
          letterSpacing: "-0.5px",
        }}
      >
        {isSignUp ? "Start Your Travel\nJourney Today" : "Welcome to Your\nTravel Management App"}
      </h1>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Full Name field - only for sign up */}
        {isSignUp && (
          <div>
            <label
              htmlFor="fullName"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "500",
                marginBottom: "0.5rem",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                borderRadius: "6px",
                color: "white",
                fontSize: "0.95rem",
                fontStyle: "italic",
                transition: "all 0.3s ease",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.target.style.background = "rgba(255, 255, 255, 0.25)";
                e.target.style.borderColor = "rgba(255, 255, 255, 0.4)";
              }}
              onBlur={(e) => {
                e.target.style.background = "rgba(255, 255, 255, 0.15)";
                e.target.style.borderColor = "rgba(255, 255, 255, 0.25)";
              }}
            />
          </div>
        )}

        {/* Email field */}
        <div>
          <label
            htmlFor="email"
            style={{
              display: "block",
              fontSize: "0.875rem",
              fontWeight: "500",
              marginBottom: "0.5rem",
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "rgba(255, 255, 255, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              borderRadius: "6px",
              color: "white",
              fontSize: "0.95rem",
              fontStyle: "italic",
              transition: "all 0.3s ease",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.25)";
              e.target.style.borderColor = "rgba(255, 255, 255, 0.4)";
            }}
            onBlur={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.15)";
              e.target.style.borderColor = "rgba(255, 255, 255, 0.25)";
            }}
          />
        </div>

        {/* Password field */}
        <div>
          <label
            htmlFor="password"
            style={{
              display: "block",
              fontSize: "0.875rem",
              fontWeight: "500",
              marginBottom: "0.5rem",
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            Password
          </label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                paddingRight: "2.5rem",
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                borderRadius: "6px",
                color: "white",
                fontSize: "0.95rem",
                fontStyle: "italic",
                transition: "all 0.3s ease",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.target.style.background = "rgba(255, 255, 255, 0.25)";
                e.target.style.borderColor = "rgba(255, 255, 255, 0.4)";
              }}
              onBlur={(e) => {
                e.target.style.background = "rgba(255, 255, 255, 0.15)";
                e.target.style.borderColor = "rgba(255, 255, 255, 0.25)";
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "0.75rem",
                background: "none",
                border: "none",
                color: "rgba(255, 255, 255, 0.7)",
                cursor: "pointer",
                fontSize: "1.2rem",
                padding: "0.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.color = "rgba(255, 255, 255, 1)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.color = "rgba(255, 255, 255, 0.7)";
              }}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        {/* Confirm Password - only for sign up */}
        {isSignUp && (
          <div>
            <label
              htmlFor="confirmPassword"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "500",
                marginBottom: "0.5rem",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              Confirm Password
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  paddingRight: "2.5rem",
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  borderRadius: "6px",
                  color: "white",
                  fontSize: "0.95rem",
                  fontStyle: "italic",
                  transition: "all 0.3s ease",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.background = "rgba(255, 255, 255, 0.25)";
                  e.target.style.borderColor = "rgba(255, 255, 255, 0.4)";
                }}
                onBlur={(e) => {
                  e.target.style.background = "rgba(255, 255, 255, 0.15)";
                  e.target.style.borderColor = "rgba(255, 255, 255, 0.25)";
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  background: "none",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.7)",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.color = "rgba(255, 255, 255, 1)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.color = "rgba(255, 255, 255, 0.7)";
                }}
              >
                {showConfirmPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>
        )}

        {/* Remember me & Forgot password - only for sign in */}
        {!isSignUp && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.875rem",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  cursor: "pointer",
                  width: "1rem",
                  height: "1rem",
                  accentColor: "rgba(255, 200, 150, 0.8)",
                }}
              />
              <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>Remember me</span>
            </label>
            <Link
              href="/forgot-password"
              style={{
                color: "rgba(255, 200, 150, 0.7)",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.color = "rgba(255, 200, 150, 1)";
              }}
              onMouseLeave={(e: MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.color = "rgba(255, 200, 150, 0.7)";
              }}
            >
              Forgot password?
            </Link>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: "0.75rem",
            marginTop: "0.5rem",
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.15))",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            borderRadius: "6px",
            color: "white",
            fontWeight: "600",
            fontSize: "1rem",
            cursor: isPending ? "not-allowed" : "pointer",
            transition: "all 0.3s ease",
            opacity: isPending ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isPending) {
              (e.target as HTMLButtonElement).style.background = "linear-gradient(135deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.25))";
              (e.target as HTMLButtonElement).style.borderColor = "rgba(255, 255, 255, 0.5)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isPending) {
              (e.target as HTMLButtonElement).style.background = "linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.15))";
              (e.target as HTMLButtonElement).style.borderColor = "rgba(255, 255, 255, 0.3)";
            }
          }}
        >
          {isPending ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
        </button>
      </form>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          margin: "1.5rem 0",
        }}
      >
        <div style={{ flex: 1, height: "1px", background: "rgba(255, 255, 255, 0.2)" }} />
        <span style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "0.875rem" }}>Or continue with</span>
        <div style={{ flex: 1, height: "1px", background: "rgba(255, 255, 255, 0.2)" }} />
      </div>

      {/* Google button */}
      <button
        type="button"
        onClick={async () => {
          setMessage(null);
          setIsPending(true);
          try {
            await authClient.signIn.social(
              {
                provider: "google",
              },
              {
                onSuccess: () => {
                  (window.location as any) = "/";
                },
                onError: (ctx) => {
                  setMessage(ctx.error.message ?? "Google sign in failed");
                },
              }
            );
          } finally {
            setIsPending(false);
          }
        }}
        disabled={isPending}
        style={{
          width: "100%",
          padding: "0.75rem",
          background: "white",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          cursor: isPending ? "not-allowed" : "pointer",
          fontSize: "0.95rem",
          fontWeight: "500",
          color: "#1f2937",
          transition: "all 0.3s ease",
          opacity: isPending ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isPending) {
            (e.target as HTMLButtonElement).style.background = "rgba(255, 255, 255, 0.95)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isPending) {
            (e.target as HTMLButtonElement).style.background = "white";
          }
        }}
      >
        <GoogleIconNew />
        Continue with Google
      </button>

      {/* Sign in / Sign up link */}
      <p
        style={{
          textAlign: "center",
          marginTop: "1.5rem",
          fontSize: "0.875rem",
          color: "rgba(255, 255, 255, 0.7)",
        }}
      >
        {isSignUp ? "Already have an account? " : "Don't have an account? "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          style={{
            color: "rgba(255, 200, 150, 0.7)",
            textDecoration: "none",
            fontWeight: "600",
            transition: "color 0.2s ease",
          }}
          onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => {
            e.currentTarget.style.color = "rgba(255, 200, 150, 1)";
          }}
          onMouseLeave={(e: MouseEvent<HTMLAnchorElement>) => {
            e.currentTarget.style.color = "rgba(255, 200, 150, 0.7)";
          }}
        >
          {isSignUp ? "Sign in" : "Sign up"}
        </Link>
      </p>

      {/* Error/Success message */}
      {message ? (
        <p
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            background: "rgba(255, 100, 100, 0.2)",
            border: "1px solid rgba(255, 100, 100, 0.4)",
            borderRadius: "4px",
            color: "rgba(255, 200, 200, 1)",
            fontSize: "0.875rem",
            textAlign: "center",
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function GoogleIconNew() {
  return (
    <svg aria-hidden="true" focusable="false" height="20" viewBox="0 0 24 24" width="20" style={{ filter: "invert(1)" }}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="currentColor"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="currentColor"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="currentColor"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="currentColor"
      />
    </svg>
  );
}
