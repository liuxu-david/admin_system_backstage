import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PROVIDER_TOKENS } from "../../foundation/constants/provider-tokens";
import { SmtpEmailProvider } from "./providers/smtp.provider";
import { EmailService } from "./email.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PROVIDER_TOKENS.EMAIL_PROVIDER,
      useClass: SmtpEmailProvider,
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
