/**
 * Composição do Inventory Engine.
 *
 * Depende do Catálogo apenas como **dado** — lê `products` para saber se o
 * item é estocável. Não importa o módulo de catálogo nem o de operações:
 * estoque conhece o id da operação que consumiu, e é só isso que precisa.
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module';
import { InventoryController } from './inventory.controller';
import { InventoryMapper } from './inventory.mapper';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';

@Module({
  imports: [PrismaModule, SubscriptionPlansModule],
  controllers: [InventoryController],
  providers: [InventoryRepository, InventoryService, InventoryMapper],
  exports: [InventoryService],
})
export class InventoryModule {}
