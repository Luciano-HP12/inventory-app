import { z } from "zod";

const portSchema = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(65_535))
  .default(3000);

const apiEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: portSchema,
});

export interface ApiConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly port: number;
}

function invalidFields(error: z.ZodError): string {
  const fields = new Set(
    error.issues.map((issue) => String(issue.path[0] ?? "environment")),
  );

  return [...fields].sort().join(", ");
}

export function parseApiConfig(environment: NodeJS.ProcessEnv): ApiConfig {
  const result = apiEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(
      `Invalid API environment configuration. Check: ${invalidFields(result.error)}.`,
    );
  }

  return Object.freeze({
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
  });
}

export function loadApiConfig(): ApiConfig {
  return parseApiConfig(process.env);
}
