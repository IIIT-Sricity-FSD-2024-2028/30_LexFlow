import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getStatus() {
    return {
      message: 'LexFlow Backend Running',
      status: 'OK'
    };
  }
}