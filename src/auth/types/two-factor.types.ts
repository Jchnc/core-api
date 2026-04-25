export interface TwoFactorRequiredResponse {
  requires_2fa: true;
  two_factor_token: string;
}

export interface TrustedDevicePayload {
  userId: string;
  deviceLabel: string;
}
