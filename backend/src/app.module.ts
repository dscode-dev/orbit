import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FoundationModule } from './common';

@Module({
  imports: [FoundationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
