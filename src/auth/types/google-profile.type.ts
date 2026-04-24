export interface GoogleProfile {
  id: string;
  displayName: string;
  emails: Array<{ value: string; verified: boolean }>;
  photos: Array<{ value: string }>;
}

export interface OAuthUserPayload {
  provider: 'GOOGLE';
  providerId: string;
  email: string;
  name: string;
  isEmailVerified: boolean;
}
