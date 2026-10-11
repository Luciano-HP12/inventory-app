import { z } from "zod";

const workerEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
});

export interface WorkerConfig {
  readonly nodeEnv: "development" | "test" | "production";
}

export function parseWorkerConfig(
  environment: NodeJS.ProcessEnv,
): WorkerConfig {
  const result = workerEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(
      "Invalid worker environment configuration. Check: NODE_ENV.",
    );
  }

  return Object.freeze({ nodeEnv: result.data.NODE_ENV });
}

export function loadWorkerConfig(): WorkerConfig {
  return parseWorkerConfig(process.env);
}
