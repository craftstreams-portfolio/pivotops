export function reportError(
  error: unknown,
  context?: string
) {
  console.error("🚨 SYSTEM ERROR");

  if (context) {
    console.error("Context:", context);
  }

  console.error(error);
}