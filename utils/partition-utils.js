const CYRILLIC_TO_LATIN = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugifyForFilename(text) {
  // Types come in Russian, so transliterate instead of dropping Cyrillic letters
  const str = String(text || "").toLowerCase().trim().replace(/[а-яё]/g, (ch) => CYRILLIC_TO_LATIN[ch]);
  if (!str) return "other";
  try {
    return str
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "other";
  } catch (_e) {
    return str.replace(/[^a-z0-9]+/g, "-") || "other";
  }
}

export function partitionScheduleByType(scheduleJson) {
  const result = new Map(); // key -> { label, daysMap: Map(date -> { day, lessons: [] }) }
  const days = Array.isArray(scheduleJson?.data) ? scheduleJson.data : [];

  for (const day of days) {
    const lessons = Array.isArray(day?.lessons) ? day.lessons : [];
    for (const lesson of lessons) {
      const originalType = String(lesson.type || lesson.work_type || "").trim();
      const label = originalType || "Other";
      const key = slugifyForFilename(originalType);
      if (!result.has(key)) {
        result.set(key, { label, daysMap: new Map() });
      }
      const bucket = result.get(key);
      const dateKey = day.date;
      if (!bucket.daysMap.has(dateKey)) {
        // clone day with empty lessons
        const clonedDay = { ...day, lessons: [] };
        bucket.daysMap.set(dateKey, clonedDay);
      }
      bucket.daysMap.get(dateKey).lessons.push(lesson);
    }
  }

  const partitions = [];
  for (const [key, { label, daysMap }] of result.entries()) {
    const data = Array.from(daysMap.values()).filter((d) => Array.isArray(d.lessons) && d.lessons.length > 0);
    if (data.length === 0) continue;
    partitions.push({
      key,
      label,
      filename: `itmo-schedule-${key}.ics`,
      schedule: { code: 0, data, message: null },
    });
  }

  return partitions;
}


