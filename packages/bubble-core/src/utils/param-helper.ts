export function sanitizeParams(
  params: Record<string, unknown>
): Record<string, unknown> {
  // Remove credentials from params
  return Object.fromEntries(
    Object.entries(params).filter(([key]) => !key.startsWith('credentials'))
  );
}
