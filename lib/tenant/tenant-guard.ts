export function assertTenant(
  currentTenant: string,
  resourceTenant: string
) {
  if (
    !currentTenant ||
    currentTenant !== resourceTenant
  ) {
    throw new Error(
      "Tenant isolation violation"
    );
  }
}