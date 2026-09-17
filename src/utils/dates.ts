export function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
