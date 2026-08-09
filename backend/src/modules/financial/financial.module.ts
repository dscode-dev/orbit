/**
 * Composição do Financeiro.
 *
 * O processador de recibos mora aqui, e não no Document Center: quem reage ao
 * evento conhece quem o publica, nunca o contrário. `JobsModule` é global, e é
 * onde o processador se inscreve.
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { FinancialController } from './financial.controller';
import { FinancialMapper } from './financial.mapper';
import { FinancialRepository } from './financial.repository';
import { FinancialService } from './financial.service';
import { ReceiptEntryProcessor } from './receipt-entry.processor';

@Module({
  imports: [PrismaModule, SubscriptionPlansModule],
  controllers: [FinancialController],
  providers: [
    FinancialRepository,
    FinancialService,
    FinancialMapper,
    ReceiptEntryProcessor,
  ],
  exports: [FinancialService],
})
export class FinancialModule {}
