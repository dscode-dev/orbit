/**
 * Composição do Commercial Engine.
 *
 * Depende do Financeiro, e não o contrário: aprovar uma proposta cria receita
 * prevista, mas o Financeiro não sabe o que é um orçamento — ele só conhece
 * `source = 'QUOTE'`, um rótulo de procedência.
 *
 * O processador do evento mora aqui pelo mesmo motivo: quem reage conhece quem
 * publica.
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { FinancialModule } from '../financial/financial.module';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { QuoteController } from './quote.controller';
import { QuoteFinancialProcessor } from './quote-financial.processor';
import { QuoteMapper } from './quote.mapper';
import { QuoteRepository } from './quote.repository';
import { QuoteService } from './quote.service';

@Module({
  imports: [PrismaModule, SubscriptionPlansModule, FinancialModule],
  controllers: [QuoteController],
  providers: [
    QuoteRepository,
    QuoteService,
    QuoteMapper,
    QuoteFinancialProcessor,
  ],
  exports: [QuoteService],
})
export class QuotesModule {}
