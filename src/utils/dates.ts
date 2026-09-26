/** Calendar-day key in the device's current timezone. */
export function localDayKey(value = new Date()) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export function previousLocalDay(day: string) {
  const value = new Date(`${day}T12:00:00`);
  value.setDate(value.getDate() - 1);
  return localDayKey(value);
}

export function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function displayDay(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
