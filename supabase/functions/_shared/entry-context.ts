export function withApproximatePlace<T extends { contexts: string[] }>(
  value: T,
  approximatePlace?: string,
) {
  if (!approximatePlace || value.contexts.includes(approximatePlace)) return value;
  return { ...value, contexts: [...value.contexts.slice(0, 19), approximatePlace] };
}
