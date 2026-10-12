export interface HealthStatus {
  readonly status: "ok";
}

export function getHealthStatus(): HealthStatus {
  return { status: "ok" };
}
