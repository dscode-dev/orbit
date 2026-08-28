/** Prevent opaque physical identifiers from becoming credentials in logs. */
export function redactSensitivePath(path: string | undefined): string | null {
  if (!path) return null;
  return path.replace(/(\/assets\/qr\/)[^/?]+/g, '$1[REDACTED]');
}
