export const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function contains(haystack: string, needle: string) {
  return ` ${normalize(haystack)} `.includes(` ${normalize(needle)} `);
}
