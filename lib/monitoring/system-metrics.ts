let processedEvents = 0;

export function incrementProcessedEvents() {
  processedEvents++;
}

export function getSystemMetrics() {
  return {
    processedEvents,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
}