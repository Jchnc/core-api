export interface ResetPasswordContext {
  name: string;
  resetLink: string;
  expiresInMinutes: number;
}

export interface WelcomeContext {
  name: string;
}

export interface TwoFactorCodeContext {
  name: string;
  code: string;
  expiresInMinutes: number;
}
