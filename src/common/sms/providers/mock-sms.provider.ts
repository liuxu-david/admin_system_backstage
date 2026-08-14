import { Injectable, Logger } from "@nestjs/common";
import { ISmsProvider, SendSmsOptions, SmsSendResult } from "../interfaces/sms-provider.interface";

@Injectable()
export class MockSmsProvider implements ISmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  send(options: SendSmsOptions): Promise<SmsSendResult> {
    this.logger.log(
      `[MockSMS] To: ${options.to}, Template: ${options.template}, Params: ${JSON.stringify(options.params)}`,
    );

    return Promise.resolve({
      messageId: `sms-mock-${Date.now()}`,
      status: "sent",
    });
  }
}
