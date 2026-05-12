import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InquiriesController } from './inquiries.controller';
import { ContactMessage } from './entities/contact-message.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { InquiriesService } from './inquiries.service';

@Module({
  imports: [TypeOrmModule.forFeature([WaitlistEntry, ContactMessage])],
  controllers: [InquiriesController],
  providers: [InquiriesService],
})
export class InquiriesModule {}
