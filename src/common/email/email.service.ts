import { Inject, Injectable } from "@nestjs/common";
import { PROVIDER_TOKENS } from "../../foundation/constants/provider-tokens";
import {
  EmailSendResult,
  IEmailProvider,
  SendEmailOptions,
} from "./interfaces/email-provider.interface";

@Injectable()
export class EmailService {
  constructor(
    @Inject(PROVIDER_TOKENS.EMAIL_PROVIDER)
    private readonly emailProvider: IEmailProvider,
  ) {}

  async send(options: SendEmailOptions): Promise<EmailSendResult> {
    return this.emailProvider.send(options);
  }
}
