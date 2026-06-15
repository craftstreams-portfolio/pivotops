export function trimMap(
  map: Map<any, any>,
  limit = 5000
) {
  while (map.size > limit) {
    const firstKey = map.keys().next().value;

    map.delete(firstKey);
  }
}