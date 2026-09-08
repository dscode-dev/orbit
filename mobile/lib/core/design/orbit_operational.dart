import 'package:flutter/material.dart';
import '../theme/orbit_theme.dart';

/// Shared visual projection: callers retain ordering, labels and authority.
class OrbitServiceRow extends StatelessWidget {
  const OrbitServiceRow({
    super.key,
    required this.title,
    this.time,
    this.subtitle,
    this.detail,
    this.status,
    this.icon,
    this.onTap,
    this.accent,
    this.timeline = false,
    this.emphasis = false,
  });
  final String title;
  final String? time, subtitle, detail;
  final Widget? status;
  final IconData? icon;
  final VoidCallback? onTap;
  final Color? accent;
  final bool timeline, emphasis;

  @override
  Widget build(BuildContext context) {
    final p = context.orbit;
    final color = accent ?? p.inkMuted;
    final scale = MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 2.0);
    return Material(
      color: emphasis ? p.surfaceMuted : p.surface,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (time != null) ...[
                SizedBox(
                  width: 48 * scale,
                  child: Column(
                    children: [
                      Text(
                        time!,
                        style: OrbitType.numeric.copyWith(color: p.ink),
                      ),
                      const SizedBox(height: 8),
                      if (timeline) ...[
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                          ),
                        ),
                        Container(width: 1, height: 28, color: p.border),
                      ] else if (icon != null)
                        Icon(icon, size: 18, color: color),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
              ] else if (icon != null) ...[
                Container(
                  width: 40,
                  height: 46,
                  decoration: BoxDecoration(
                    color: p.surfaceMuted,
                    borderRadius: OrbitRadius.field,
                  ),
                  child: Icon(icon, size: 23, color: color),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: OrbitType.itemTitle.copyWith(color: p.ink),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        subtitle!,
                        style: OrbitType.caption.copyWith(color: p.inkMuted),
                      ),
                    ],
                    if (detail != null || status != null) ...[
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (detail != null)
                            Text(
                              detail!,
                              style: OrbitType.label.copyWith(
                                fontWeight: FontWeight.w400,
                                color: p.inkSubtle,
                              ),
                            ),
                          if (status != null) status!,
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              if (onTap != null) ...[
                const SizedBox(width: 4),
                Icon(Icons.chevron_right, size: 18, color: p.inkSubtle),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class OrbitAvatar extends StatelessWidget {
  const OrbitAvatar({
    super.key,
    required this.initials,
    this.url,
    this.size = 40,
  });
  final String initials;
  final String? url;
  final double size;
  @override
  Widget build(BuildContext context) {
    final p = context.orbit;
    final uri = Uri.tryParse(url ?? '');
    final fallback = Center(
      child: Text(initials, style: OrbitType.label.copyWith(color: p.inkMuted)),
    );
    return ExcludeSemantics(
      child: ClipOval(
        child: Container(
          width: size,
          height: size,
          color: p.surfaceSunken,
          child: uri?.scheme == 'https' && uri!.host.isNotEmpty
              ? Image.network(
                  uri.toString(),
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => fallback,
                )
              : fallback,
        ),
      ),
    );
  }
}

/// Labels remain available to assistive technology and long-press tooltips.
class OrbitBottomNav extends StatelessWidget {
  const OrbitBottomNav({
    super.key,
    required this.items,
    required this.selected,
    required this.onSelect,
  });
  final List<({String label, IconData icon, IconData selectedIcon})> items;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final p = context.orbit;
    return Material(
      color: p.surface,
      child: SafeArea(
        top: false,
        child: Container(
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: p.border)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: Semantics(
                    label: items[i].label,
                    selected: selected == i,
                    button: true,
                    onTap: () => onSelect(i),
                    excludeSemantics: true,
                    child: Tooltip(
                      message: items[i].label,
                      child: InkWell(
                        borderRadius: OrbitRadius.field,
                        onTap: () => onSelect(i),
                        child: SizedBox(
                          height: 52,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                selected == i
                                    ? items[i].selectedIcon
                                    : items[i].icon,
                                size: 24,
                                color: selected == i ? p.accent : p.inkSubtle,
                              ),
                              const SizedBox(height: 5),
                              Container(
                                width: 4,
                                height: 4,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: selected == i
                                      ? p.accent
                                      : Colors.transparent,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
