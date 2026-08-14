import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EmailSendResult,
  IEmailProvider,
  SendEmailOptions,
} from "../interfaces/email-provider.interface";

@Injectable()
export class SmtpEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);

  constructor(private readonly configService: ConfigService) {}

  send(options: SendEmailOptions): Promise<EmailSendResult> {
    // In production, integrate nodemailer or similar here.
    // For now, log and return a mock result.
    this.logger.log(
      `[SMTP] Sending email to ${Array.isArray(options.to) ? options.to.join(",") : options.to} - Subject: ${options.subject}`,
    );

    return Promise.resolve({
      messageId: `smtp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      accepted: Array.isArray(options.to) ? options.to : [options.to],
    });
  }
}
