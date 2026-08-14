import { Inject, Injectable } from "@nestjs/common";
import { PROVIDER_TOKENS } from "../../foundation/constants/provider-tokens";
import { ISmsProvider, SendSmsOptions, SmsSendResult } from "./interfaces/sms-provider.interface";

@Injectable()
export class SmsService {
  constructor(
    @Inject(PROVIDER_TOKENS.SMS_PROVIDER)
    private readonly smsProvider: ISmsProvider,
  ) {}

  async send(options: SendSmsOptions): Promise<SmsSendResult> {
    return this.smsProvider.send(options);
  }
}
