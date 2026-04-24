export function buildConfigServiceMock() {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const map: Record<string, string | number> = {
        'jwt.accessSecret': 'test-access-secret',
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.refreshExpiresIn': '30d',
        'app.nodeEnv': 'test',
        'app.frontendUrl': 'http://localhost:3001',
        'app.passwordResetTokenTtl': 3600,
      };
      return map[key] !== undefined ? map[key] : defaultValue;
    }),
    getOrThrow: jest.fn((key: string) => {
      const map: Record<string, string | number> = {
        'jwt.accessSecret': 'test-access-secret',
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.refreshExpiresIn': '30d',
        'app.nodeEnv': 'test',
        'app.frontendUrl': 'http://localhost:3001',
        'app.passwordResetTokenTtl': 3600,
      };
      if (!map[key]) throw new Error(`Missing config: ${key}`);
      return map[key];
    }),
  };
}
