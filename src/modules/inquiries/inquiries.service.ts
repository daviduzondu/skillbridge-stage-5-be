import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { ContactMessage } from './entities/contact-message.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import {
  ConflictError,
  ErrorMessages,
  SuccessMessages,
} from '../../shared';

@Injectable()
export class InquiriesService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepository: Repository<WaitlistEntry>,
    @InjectRepository(ContactMessage)
    private readonly contactMessageRepository: Repository<ContactMessage>,
  ) {}

  async joinWaitlist(
    dto: JoinWaitlistDto,
  ): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existingEntry = await this.waitlistRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingEntry) {
      throw new ConflictError(ErrorMessages.INQUIRIES.EMAIL_ALREADY_ON_WAITLIST);
    }

    await this.waitlistRepository.save(
      this.waitlistRepository.create({
        email: normalizedEmail,
        joiningAs: dto.joiningAs,
        fullName: dto.fullName.trim(),
        preferredRole: dto.preferredRole?.trim() || null,
        referralSource: dto.referralSource?.trim() || null,
      }),
    );

    return { success: true, message: SuccessMessages.INQUIRIES.WAITLIST_JOINED };
  }

  async createContactMessage(
    dto: CreateContactMessageDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.contactMessageRepository.save(
      this.contactMessageRepository.create({
        fullName: dto.fullName.trim(),
        email: dto.email.trim().toLowerCase(),
        subject: dto.subject.trim(),
        message: dto.message.trim(),
      }),
    );

    return { success: true, message: SuccessMessages.INQUIRIES.MESSAGE_RECEIVED };
  }
}
