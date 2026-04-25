import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from './google.strategy';
import type { GoogleProfile } from '../types/google-profile.type';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'GOOGLE_CLIENT_ID') return 'client-id';
              if (key === 'GOOGLE_CLIENT_SECRET') return 'client-secret';
              if (key === 'GOOGLE_CALLBACK_URL') return 'callback-url';
              return null;
            }),
          },
        },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should map profile to payload successfully', () => {
      const profile = {
        id: '123456',
        displayName: 'John Doe',
        emails: [{ value: 'john@example.com', verified: true }],
      } as GoogleProfile;

      const doneFn = jest.fn();

      strategy.validate('access', 'refresh', profile, doneFn);

      expect(doneFn).toHaveBeenCalledWith(null, {
        provider: 'GOOGLE',
        providerId: '123456',
        email: 'john@example.com',
        name: 'John Doe',
        isEmailVerified: true,
      });
    });

    it('should error when no email is provided', () => {
      const profile = {
        id: '123456',
        displayName: 'John Doe',
        emails: [],
      } as unknown as GoogleProfile;

      const doneFn = jest.fn();

      strategy.validate('access', 'refresh', profile, doneFn);

      expect(doneFn).toHaveBeenCalledWith(expect.any(Error), undefined);
      expect(doneFn.mock.calls[0][0].message).toEqual('No email returned from Google');
    });
  });
});
