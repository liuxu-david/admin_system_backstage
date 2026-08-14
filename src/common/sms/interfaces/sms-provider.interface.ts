export interface SendSmsOptions {
  to: string;
  template: string;
  params?: Record<string, string>;
}

export interface SmsSendResult {
  messageId: string;
  status: "sent" | "failed";
}

export interface ISmsProvider {
  send(options: SendSmsOptions): Promise<SmsSendResult>;
}
