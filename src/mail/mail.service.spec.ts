import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';

describe('MailService', () => {
  let service: MailService;
  let mailerService: MailerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MailerService,
          useValue: {
            sendMail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get<MailerService>(MailerService);

    // Suppress expected error logs
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPasswordReset', () => {
    const email = 'test@example.com';
    const context = {
      name: 'John',
      resetLink: 'http://localhost:3000/reset',
      expiresInMinutes: 60,
    };

    it('should successfully send a password reset email', async () => {
      jest.spyOn(mailerService, 'sendMail').mockResolvedValue(undefined);

      await service.sendPasswordReset(email, context);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: email,
        subject: 'Reset your password',
        template: 'reset-password',
        context,
      });
    });

    it('should throw an error and log if sending fails', async () => {
      const error = new Error('SMTP Error');
      jest.spyOn(mailerService, 'sendMail').mockRejectedValue(error);

      await expect(service.sendPasswordReset(email, context)).rejects.toThrow(error);
      expect(Logger.prototype.error).toHaveBeenCalled();
    });
  });

  describe('sendWelcome', () => {
    const email = 'test@example.com';
    const context = { name: 'John', loginUrl: 'http://localhost:3000/login' };

    it('should successfully send a welcome email', async () => {
      jest.spyOn(mailerService, 'sendMail').mockResolvedValue(undefined);

      await service.sendWelcome(email, context);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: email,
        subject: 'Welcome aboard',
        template: 'welcome',
        context,
      });
    });

    it('should log and rethrow if sending fails', async () => {
      const error = new Error('SMTP Error');
      jest.spyOn(mailerService, 'sendMail').mockRejectedValueOnce(error);

      await expect(service.sendWelcome(email, context)).rejects.toThrow('SMTP Error');

      expect(Logger.prototype.error).toHaveBeenCalled();
    });
  });
});
