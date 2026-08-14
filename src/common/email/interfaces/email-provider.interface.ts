export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailSendResult {
  messageId: string;
  accepted: string[];
}

export interface IEmailProvider {
  send(options: SendEmailOptions): Promise<EmailSendResult>;
}
