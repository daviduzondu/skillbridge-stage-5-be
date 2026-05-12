import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { OutboundEmailQueueService } from './outbound-email-queue.service';

@Global()
@Module({
  providers: [OutboundEmailQueueService, MailService],
  exports: [MailService],
})
export class MailModule {}
