import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { SuccessMessages } from './shared';

@ApiTags('welcome')
@Controller()
export class WelcomeController {
  @Public()
  @Get(['', 'api', 'api/v1'])
  @ApiOperation({ summary: 'API welcome route' })
  welcome() {
    return {
      status_code: 200,
      message: SuccessMessages.COMMON.API_PROBE,
    };
  }
}
