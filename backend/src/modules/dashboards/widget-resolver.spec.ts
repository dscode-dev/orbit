import { WidgetRegistry } from './widget-registry';
import { WidgetResolver } from './widget-resolver';

describe('WidgetResolver', () => {
  const registry = new WidgetRegistry();
  const resolver = new WidgetResolver();

  const base = {
    organizationId: 'organization',
    organizationName: 'Orbit',
    planKey: 'PRO',
    subscriptionStatus: 'ACTIVE',
    modules: ['operations', 'reports', 'assets', 'customers', 'catalog', 'ai'],
    planCapabilities: ['dashboard.read'],
    permissions: [
      'dashboard.read',
      'operations.read',
      'reports.read',
      'pmoc.read',
      'assets.read',
      'customers.read',
      'catalog.read',
      'ai.executions.read',
    ],
  };

  it('resolves global and HVAC-R widgets using a normalized segment', () => {
    const widgets = resolver.resolve(registry.all(), {
      ...base,
      segment: 'HVAC-R',
    });
    const ids = widgets.map((widget) => widget.id);
    expect(ids).toContain('attention-center');
    expect(ids).toContain('hvac-pmoc-status');
    expect(ids).toContain('weather-environmental-intelligence');
    expect(ids).not.toContain('pharmacy-critical-stock');
  });

  it('reuses environmental intelligence for Agro', () => {
    const widgets = resolver.resolve(registry.all(), {
      ...base,
      segment: 'Agronegócio',
    });
    const ids = widgets.map((widget) => widget.id);
    expect(ids).toContain('agro-fields-overview');
    expect(ids).toContain('weather-environmental-intelligence');
    expect(ids).not.toContain('hvac-pmoc-status');
  });

  it('removes widgets when a permission or module is unavailable', () => {
    const widgets = resolver.resolve(registry.all(), {
      ...base,
      segment: 'Farmácia',
      modules: [],
      permissions: ['dashboard.read'],
    });
    const ids = widgets.map((widget) => widget.id);
    expect(ids).toContain('executive-kpis');
    expect(ids).not.toContain('pharmacy-critical-stock');
    expect(ids).not.toContain('operational-trend');
  });

  it('filters by registry tags without changing layout logic', () => {
    const widgets = resolver.resolve(registry.all(), {
      ...base,
      segment: 'HVAC',
      tags: ['environment'],
    });
    expect(widgets.map((widget) => widget.id)).toEqual([
      'weather-environmental-intelligence',
    ]);
  });

  it('uses pmoc.read rather than reports.read for the PMOC widget', () => {
    const withPmoc = resolver.resolve(registry.all(), {
      ...base,
      segment: 'HVAC-R',
      modules: base.modules.filter((module) => module !== 'reports'),
      permissions: ['dashboard.read', 'pmoc.read'],
    });
    expect(withPmoc.map((widget) => widget.id)).toContain('hvac-pmoc-status');

    const reportsOnly = resolver.resolve(registry.all(), {
      ...base,
      segment: 'HVAC-R',
      permissions: ['dashboard.read', 'reports.read'],
    });
    expect(reportsOnly.map((widget) => widget.id)).not.toContain(
      'hvac-pmoc-status',
    );
  });
});
