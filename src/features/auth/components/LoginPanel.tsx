import { useState } from "react";
import type { FormEvent } from "react";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { APP_BRAND_NAME, DEFAULT_APP_LOGO_SRC } from "../../../constants/branding";
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
      <Card className="w-full max-w-md" aria-label="Login lokal">
        <CardHeader>
          <div className="login-brand">
            <span className="login-brand-mark" aria-hidden="true">
              <img alt="" src={DEFAULT_APP_LOGO_SRC} />
            </span>
            <p className="eyebrow">{APP_BRAND_NAME}</p>
          </div>
          <CardTitle>Login Lokal</CardTitle>
          <CardDescription>{LOGIN_HELP_TEXT}</CardDescription>
        </CardHeader>

        <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Username
            <Input
              autoComplete="username"
              disabled={isLoading || isSubmitting}
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            Password
            <span className="relative">
              <Input
                className="pr-10"
                autoComplete="current-password"
                disabled={isLoading || isSubmitting}
                onChange={(event) => setPassword(event.target.value)}
                required
                type={isPasswordVisible ? "text" : "password"}
                value={password}
              />
              <Button
                aria-label={isPasswordVisible ? "Sembunyikan password" : "Lihat password"}
                className="absolute right-1 top-1/2 -translate-y-1/2"
                disabled={isLoading || isSubmitting}
                onClick={() => setIsPasswordVisible((current) => !current)}
                size="icon"
                type="button"
                variant="ghost"
              >
                {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
            </span>
          </label>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <Button disabled={isLoading || isSubmitting} type="submit">
            {isSubmitting ? "Memeriksa..." : "Login"}
          </Button>
        </form>
        </CardContent>

        <CardFooter className="grid gap-1 text-sm text-muted-foreground" aria-label="Akun awal">
          <strong className="text-foreground">Akun awal V1</strong>
          <span>admin.payroll / admin</span>
          <span>owner / owner</span>
          <span>viewer / viewer</span>
        </CardFooter>
      </Card>
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
