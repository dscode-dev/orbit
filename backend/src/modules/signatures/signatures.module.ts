import { Module } from '@nestjs/common';
import { SignatureController } from './signature.controller';
import { SignatureRepository } from './signature.repository';
import { SignatureService } from './signature.service';

@Module({
  controllers: [SignatureController],
  providers: [SignatureRepository, SignatureService],
  exports: [SignatureService],
})
export class SignaturesModule {}
