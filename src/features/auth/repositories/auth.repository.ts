import type { AuthSession, LoginInput, LoginResult } from "../types";

export type AuthRepository = {
  getSession: () => Promise<AuthSession | null>;
  login: (input: LoginInput) => Promise<LoginResult>;
  logout: () => Promise<void>;
};
