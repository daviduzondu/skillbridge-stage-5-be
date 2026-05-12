import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { SuccessMessages } from './shared';

@ApiTags('probe')
@Controller('probe')
export class ProbeController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Readiness probe' })
  check() {
    return {
      status_code: 200,
      message: SuccessMessages.COMMON.API_PROBE,
    };
  }
}
