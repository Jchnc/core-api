export interface ResetPasswordContext {
  name: string;
  resetLink: string;
  expiresInMinutes: number;
}

export interface WelcomeContext {
  name: string;
}
