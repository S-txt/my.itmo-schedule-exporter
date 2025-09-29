import { toIsoLocal } from "./date-utils.js";

function escapeText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function scheduleToICS(scheduleJson) {
  const lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//ITMO//Schedule Extension//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  const nowIso = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  const days = Array.isArray(scheduleJson?.data) ? scheduleJson.data : [];
  for (const day of days) {
    const date = day?.date; // YYYY-MM-DD
    const lessons = Array.isArray(day?.lessons) ? day.lessons : [];
    for (const lesson of lessons) {
      const uid = `${lesson.pair_id || cryptoRandom()}@itmo.ru`;
      const dtstart = toIsoLocal(date, lesson.time_start);
      const dtend = toIsoLocal(date, lesson.time_end);
      const summary = escapeText(lesson.subject || "Lesson");
      const description = escapeText(
        `Тип: ${lesson.type || lesson.work_type || ""}\nПреподаватель: ${lesson.teacher_name || ""}\nГруппа: ${lesson.group || ""}\nФормат: ${lesson.format || ""}`
      );
      const location = escapeText(lesson.building || lesson.room || lesson.format || "");

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${nowIso}`);
      lines.push(`DTSTART:${dtstart}`);
      lines.push(`DTEND:${dtend}`);
      lines.push(`SUMMARY:${summary}`);
      lines.push(`DESCRIPTION:${description}`);
      if (location) lines.push(`LOCATION:${location}`);
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\n");
}

function cryptoRandom() {
  try {
    const arr = new Uint32Array(2);
    crypto.getRandomValues(arr);
    return `${arr[0]}${arr[1]}`;
  } catch (_e) {
    return String(Math.floor(Math.random() * 1e12));
  }
}


