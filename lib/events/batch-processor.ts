export async function processBatch(
  events: any[],
  handler: (event: any) => Promise<any>
) {
  await Promise.all(
    events.map((event) => handler(event))
  );
}