import { useState } from "react";
import type { FormEvent } from "react";
import { LOGIN_HELP_TEXT } from "../constants";
import type { LoginInput } from "../types";

type LoginPanelProps = {
  errorMessage: string | null;
  isLoading: boolean;
  onLogin: (input: LoginInput) => Promise<boolean>;
};

export function LoginPanel({ errorMessage, isLoading, onLogin }: LoginPanelProps) {
  const [username, setUsername] = useState("admin.payroll");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onLogin({ username, password });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-label="Login lokal">
        <div className="login-heading">
          <p className="eyebrow">HRIS Payroll Klinik</p>
          <h1>Login Lokal</h1>
          <p>{LOGIN_HELP_TEXT}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              autoComplete="username"
              disabled={isLoading || isSubmitting}
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </label>

          <label>
            Password
            <span className="password-field">
              <input
                autoComplete="current-password"
                disabled={isLoading || isSubmitting}
                onChange={(event) => setPassword(event.target.value)}
                required
                type={isPasswordVisible ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={isPasswordVisible ? "Sembunyikan password" : "Lihat password"}
                disabled={isLoading || isSubmitting}
                onClick={() => setIsPasswordVisible((current) => !current)}
                type="button"
              >
                {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
          </label>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

          <button className="primary-button" disabled={isLoading || isSubmitting} type="submit">
            {isSubmitting ? "Memeriksa..." : "Login"}
          </button>
        </form>

        <div className="login-accounts" aria-label="Akun awal">
          <strong>Akun awal V1</strong>
          <span>admin.payroll / admin</span>
          <span>owner / owner</span>
          <span>viewer / viewer</span>
        </div>
      </section>
    </main>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m3 3 18 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6 0 9.5 7 9.5 7a16.4 16.4 0 0 1-2.2 3.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M6.4 6.9C3.9 8.7 2.5 12 2.5 12s3.5 7 9.5 7c1.5 0 2.9-.4 4.1-1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
