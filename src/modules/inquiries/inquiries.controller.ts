import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { InquiriesService } from './inquiries.service';

@ApiTags('inquiries')
@Controller()
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Public()
  @Post('waitlist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Join the waitlist',
    description:
      'Captures joining intent (talent/employer), full name, email, optional preferred role and referral source.',
  })
  joinWaitlist(@Body() dto: JoinWaitlistDto) {
    return this.inquiriesService.joinWaitlist(dto);
  }

  @Public()
  @Post('contact-us')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a contact-us message' })
  createContactMessage(@Body() dto: CreateContactMessageDto) {
    return this.inquiriesService.createContactMessage(dto);
  }
}
