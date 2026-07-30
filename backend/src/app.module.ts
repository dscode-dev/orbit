import './configure-environment';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FoundationModule } from './common';
import { PrismaModule } from './database';
import { IdentityModule } from './modules/identity/identity.module';

@Module({
  imports: [FoundationModule, PrismaModule, IdentityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
