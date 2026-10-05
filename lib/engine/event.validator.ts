export function validateEvent(event: any): boolean {
  if (!event) return false;
  if (!event.type) return false;
  if (!event.payload) return false;

  if (!event.payload.candidate_id && !event.payload.task_id) {
    console.warn("⚠️ Event missing entity reference:", event);
    return false;
  }

  return true;
}