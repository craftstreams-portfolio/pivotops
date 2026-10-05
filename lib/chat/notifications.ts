export function getUnreadCount(
  messages: Array<{ created_at: string }>,
  lastReadAt?: string | null
) {
  if (!lastReadAt) return messages.length;

  return messages.filter(
    (m) => new Date(m.created_at) > new Date(lastReadAt)
  ).length;
}
