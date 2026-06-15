export function buildTenantKey(tenantId: string, type: string) {
  return `tenant:${tenantId}:type:${type}`;
}

export function getOrderingScore(index: number) {
  return Date.now() + index;
}