import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SuccessMessages } from '../../shared';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  check() {
    return {
      status_code: 200,
      message: SuccessMessages.COMMON.SUCCESS,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
