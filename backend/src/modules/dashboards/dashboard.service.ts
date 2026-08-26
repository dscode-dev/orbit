import { Injectable } from '@nestjs/common';
import { EntityNotFoundException, ForbiddenException } from '../../exceptions';
import type { AuthenticatedIdentity } from '../identity/domain/identity.types';
import type { DashboardQueryDto } from './dto/dashboard.dto';
import { DashboardRepository } from './dashboard.repository';
import { WidgetFactory } from './widget-factory';
import { WidgetRegistry } from './widget-registry';
import { WidgetResolver } from './widget-resolver';

@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly registry: WidgetRegistry,
    private readonly resolver: WidgetResolver,
    private readonly factory: WidgetFactory,
  ) {}

  async get(identity: AuthenticatedIdentity, query: DashboardQueryDto) {
    const context = await this.context(identity);
    const definitions = this.resolver.resolve(this.registry.all(), {
      ...context,
      permissions: identity.permissions,
      tags: query.tags,
    });
    return {
      context: {
        organizationId: context.organizationId,
        organizationName: context.organizationName,
        segment: this.resolver.normalizeSegment(context.segment),
        plan: context.planKey,
        modules: context.modules,
        range: query.range,
      },
      layout: {
        version: 1,
        widgets: await Promise.all(
          definitions.map((definition) =>
            this.factory.create(
              definition,
              query.range,
              context.organizationId,
            ),
          ),
        ),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getWidget(
    id: string,
    identity: AuthenticatedIdentity,
    query: DashboardQueryDto,
  ) {
    const context = await this.context(identity);
    const definition = this.registry.get(id);
    const [available] = this.resolver.resolve([definition], {
      ...context,
      permissions: identity.permissions,
      tags: query.tags,
    });
    if (!available)
      throw new ForbiddenException(
        'Widget is not available for the current dashboard context',
      );
    return this.factory.create(available, query.range, context.organizationId);
  }

  private async context(identity: AuthenticatedIdentity) {
    if (!identity.organizationId)
      throw new ForbiddenException('Organization context is required');
    const context = await this.repository.context(identity.organizationId);
    if (!context) throw new EntityNotFoundException('Organization');
    return context;
  }
}
