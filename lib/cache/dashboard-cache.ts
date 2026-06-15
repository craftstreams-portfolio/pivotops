const cache = new Map<string, any>();

export function setCache(
  key: string,
  value: any
) {
  cache.set(key, {
    value,
    timestamp: Date.now(),
  });
}

export function getCache(key: string) {
  const item = cache.get(key);

  if (!item) return null;

  const isExpired =
    Date.now() - item.timestamp > 30000;

  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return item.value;
}