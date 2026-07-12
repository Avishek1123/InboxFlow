/** Minimal cron matcher for 5-field expressions: m h dom mon dow */
export function cronMatchesNow(
  expression: string | null | undefined,
  date = new Date(),
  _timezone = "UTC"
): boolean {
  if (!expression?.trim()) return true;
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return true;

  const [min, hour, dom, mon, dow] = parts;
  const values = {
    minute: date.getUTCMinutes(),
    hour: date.getUTCHours(),
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    weekday: date.getUTCDay(),
  };

  return (
    fieldMatches(min!, values.minute, 0, 59) &&
    fieldMatches(hour!, values.hour, 0, 23) &&
    fieldMatches(dom!, values.day, 1, 31) &&
    fieldMatches(mon!, values.month, 1, 12) &&
    fieldMatches(dow!, values.weekday, 0, 6)
  );
}

function fieldMatches(
  field: string,
  value: number,
  min: number,
  max: number
): boolean {
  if (field === "*") return true;
  if (field.includes("/")) {
    const [range, stepStr] = field.split("/");
    const step = Number(stepStr);
    if (!step) return false;
    const start = range === "*" ? min : Number(range);
    return value >= start && (value - start) % step === 0;
  }
  if (field.includes(",")) {
    return field.split(",").some((p) => fieldMatches(p, value, min, max));
  }
  if (field.includes("-")) {
    const [a, b] = field.split("-").map(Number);
    return value >= a! && value <= b!;
  }
  return Number(field) === value;
}
