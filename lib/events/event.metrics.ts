export type WorkerMetrics = {
  workerId: string;

  processed: number;
  failed: number;

  avgDurationMs: number;
};