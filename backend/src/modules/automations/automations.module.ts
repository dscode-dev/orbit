/**
 * Composição do Automation Engine.
 *
 * `DomainEventEmitter` é exportado porque **os domínios o injetam**: quem
 * conhece o fato é quem o emite. O motor não observa tabelas nem escuta o
 * banco — seria adivinhação sobre o que aconteceu, e adivinhação é o que um
 * evento existe para dispensar.
 *
 * Os dois processadores se inscrevem no `JobProcessorRegistry` global.
 */
import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { AutomationActionProcessor } from './automation-action.processor';
import { AutomationController } from './automation.controller';
import { AutomationDispatchProcessor } from './automation-dispatch.processor';
import { AutomationMapper } from './automation.mapper';
import { AutomationRepository } from './automation.repository';
import { AutomationService } from './automation.service';
import { DomainEventEmitter } from './domain-event.emitter';

/**
 * Global porque a emissão é transversal.
 *
 * Operações, orçamentos e estoque emitem eventos; obrigá-los a importar o
 * módulo de automação inverteria a dependência — o domínio passaria a conhecer
 * quem reage a ele.
 */
@Global()
@Module({
  imports: [PrismaModule, SubscriptionPlansModule],
  controllers: [AutomationController],
  providers: [
    AutomationRepository,
    AutomationService,
    AutomationMapper,
    DomainEventEmitter,
    AutomationDispatchProcessor,
    AutomationActionProcessor,
  ],
  exports: [DomainEventEmitter, AutomationService],
})
export class AutomationsModule {}
