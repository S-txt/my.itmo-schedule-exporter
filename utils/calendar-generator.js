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
  console.log(days);
  for (const day of days) {
    const date = day?.date; // YYYY-MM-DD
    
    const lessons = Array.isArray(day?.lessons) ? day.lessons : [];
    for (const lesson of lessons) {
      const uid = lesson.pair_id;
      const dtstart = toIsoLocal(date, lesson.time_start);
      const dtend = toIsoLocal(date, lesson.time_end);
      const subject = lesson.subject || lesson.subject_id;
      const typeSuffix = (lesson.type || lesson.work_type) ? `${String(lesson.type || lesson.work_type).trim()}` : "";
      const summary = escapeText(`${subject} — ${typeSuffix}`);
      const descriptionText = [
        (lesson.type || lesson.work_type) ? `Тип: ${lesson.type || lesson.work_type}` : "",
        lesson.teacher_name ? `Преподаватель: ${lesson.teacher_name}` : "",
        lesson.group ? `Группа: ${lesson.group}` : "",
        lesson.format ? `Формат: ${lesson.format}` : "",
        lesson.note ? `Заметка: ${lesson.note}` : "",
      ].filter(Boolean).join("\n");
      const description = escapeText(descriptionText);
      const location = escapeText(lesson.building || lesson.room || lesson.format || "");
      const { category, colorHex } = mapLessonTypeToCategoryAndColor(lesson.type || lesson.work_type);

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${nowIso}`);
      lines.push(`DTSTART:${dtstart}`);
      lines.push(`DTEND:${dtend}`);
      lines.push(`SUMMARY:${summary}`);
      lines.push(`DESCRIPTION:${description}`);
      if (location) lines.push(`LOCATION:${location}`);
      if (category) lines.push(`CATEGORIES:${escapeText(category)},ITMO`);
      if (colorHex) lines.push(`COLOR:${colorHex}`); // RFC 7986, may be ignored by some clients
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

function mapLessonTypeToCategoryAndColor(typeRaw) {
  const t = String(typeRaw || "").toLowerCase().trim();
  // Russian aliases → English category + color aligned with ITMO palette
  if (!t) return { category: "Lesson", colorHex: "#1a5cff" };
  if (/(лекц|lecture)/.test(t)) return { category: "Lecture", colorHex: "#1a5cff" };
  if (/(практ|seminar|practice)/.test(t)) return { category: "Practice", colorHex: "#00b894" };
  if (/(лаб|labor)/.test(t)) return { category: "Lab", colorHex: "#6c5ce7" };
  if (/(экзам|exam)/.test(t)) return { category: "Exam", colorHex: "#e74c3c" };
  if (/(зач|test|credit)/.test(t)) return { category: "Test", colorHex: "#f39c12" };
  if (/(консульт|consult)/.test(t)) return { category: "Consultation", colorHex: "#10b981" };
  return { category: "Lesson", colorHex: "#2d3436" };
}


