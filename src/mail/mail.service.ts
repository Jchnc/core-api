import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { ResetPasswordContext, WelcomeContext, TwoFactorCodeContext } from './mail.types';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Send a password reset email to the user
   * @param to User email address
   * @param context Password reset context
   */
  async sendPasswordReset(to: string, context: ResetPasswordContext): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to,
        subject: 'Reset your password',
        template: 'reset-password',
        context,
      });
    } catch (error) {
      this.logger.error(`Failed to send reset email to ${this.maskEmail(to)}`, error);
      throw error;
    }
  }

  /**
   * Send a welcome email to the user
   * @param to User email address
   * @param context Welcome email context
   */
  async sendWelcome(to: string, context: WelcomeContext): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to,
        subject: 'Welcome aboard',
        template: 'welcome',
        context,
      });
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${this.maskEmail(to)}`, error);
    }
  }

  /**
   * Send a 2FA code to the user
   * @param to User email address
   * @param context 2FA code context
   */
  async sendTwoFactorCode(to: string, context: TwoFactorCodeContext): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to,
        subject: 'Your verification code',
        template: 'two-factor-code',
        context,
      });
    } catch (error) {
      this.logger.error(`Failed to send 2FA code to ${this.maskEmail(to)}`, error);
      throw error;
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    return `${local.slice(0, 2)}***@${domain}`;
  }
}
