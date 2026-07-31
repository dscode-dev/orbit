import { Injectable } from '@nestjs/common';
import type { DashboardWidgetDefinition } from './dashboard.read-models';
import type { DashboardTenantContext } from './dashboard.repository';

export type WidgetResolutionContext = DashboardTenantContext & {
  permissions: readonly string[];
  tags?: readonly string[];
};

@Injectable()
export class WidgetResolver {
  resolve(
    widgets: readonly DashboardWidgetDefinition[],
    context: WidgetResolutionContext,
  ) {
    const segment = this.segment(context.segment);
    const modules = new Set(
      context.modules.map((value) => value.toLowerCase()),
    );
    const permissions = new Set(context.permissions);
    const requestedTags = new Set(context.tags ?? []);
    return widgets
      .filter(
        (widget) =>
          this.supportsSegment(widget, segment) &&
          this.includes(widget.requiredModules, modules) &&
          this.supportsPlan(widget, context.planKey) &&
          this.includesPermissions(widget.requiredPermissions, permissions) &&
          this.supportsTags(widget, requestedTags),
      )
      .sort(
        (left, right) =>
          left.order - right.order || left.id.localeCompare(right.id),
      );
  }

  normalizeSegment(value: string) {
    return this.segment(value);
  }

  private segment(value: string) {
    const normalized = value
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    const aliases: Record<string, string> = {
      HVAC: 'HVAC_R',
      HVACR: 'HVAC_R',
      HVAC_R: 'HVAC_R',
      FARMACIA: 'PHARMACY',
      PHARMACY: 'PHARMACY',
      PHARMA: 'PHARMACY',
      AGRO: 'AGRO',
      AGRONEGOCIO: 'AGRO',
      AGRIBUSINESS: 'AGRO',
    };
    return aliases[normalized] ?? normalized;
  }

  private supportsSegment(widget: DashboardWidgetDefinition, segment: string) {
    return (
      widget.supportedSegments.length === 0 ||
      widget.supportedSegments.includes(segment)
    );
  }

  private includes(required: readonly string[], granted: Set<string>) {
    return required.every((value) => granted.has(value.toLowerCase()));
  }

  private includesPermissions(
    required: readonly string[],
    permissions: Set<string>,
  ) {
    return (
      permissions.has('*') ||
      required.every((permission) => permissions.has(permission))
    );
  }

  private supportsPlan(widget: DashboardWidgetDefinition, planKey: string) {
    return (
      widget.requiredPlans.length === 0 ||
      widget.requiredPlans.includes(planKey.toUpperCase())
    );
  }

  private supportsTags(
    widget: DashboardWidgetDefinition,
    requested: Set<string>,
  ) {
    return (
      requested.size === 0 ||
      widget.tags.some((tag) => requested.has(tag.toLowerCase()))
    );
  }
}
