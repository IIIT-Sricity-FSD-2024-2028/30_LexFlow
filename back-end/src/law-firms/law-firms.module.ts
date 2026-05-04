import { Module } from '@nestjs/common';
import { LawFirmsController } from './law-firms.controller';
import { LawFirmsService } from './law-firms.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports:     [UsersModule],
  controllers: [LawFirmsController],
  providers:   [LawFirmsService],
  exports:     [LawFirmsService],
})
export class LawFirmsModule {}
