import { Global, Module } from "@nestjs/common";
import { PROVIDER_TOKENS } from "../../foundation/constants/provider-tokens";
import { MockSmsProvider } from "./providers/mock-sms.provider";
import { SmsService } from "./sms.service";

@Global()
@Module({
  providers: [
    {
      provide: PROVIDER_TOKENS.SMS_PROVIDER,
      useClass: MockSmsProvider,
    },
    SmsService,
  ],
  exports: [SmsService],
})
export class SmsModule {}
