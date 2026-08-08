type LogLevel = "debug" | "info" | "warn" | "error";
interface LogEntry { level: LogLevel; message: string; timestamp: string; service: string; [key: string]: unknown; }
function emit(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
  const entry: LogEntry = { level, message, timestamp: new Date().toISOString(), service: "pivotops", ...meta };
  const line = JSON.stringify(entry);
  switch (level) {
    case "debug": console.debug(line); break;
    case "info":  console.info(line);  break;
    case "warn":  console.warn(line);  break;
    case "error": console.error(line); break;
  }
}
export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit("debug", message, meta),
  info:  (message: string, meta?: Record<string, unknown>) => emit("info",  message, meta),
  warn:  (message: string, meta?: Record<string, unknown>) => emit("warn",  message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
};