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
  const groups = new Map(); // key -> { event, occurrences: [{date, lesson}], sample }
  for (const day of days) {
    const date = day?.date;
    const lessons = Array.isArray(day?.lessons) ? day.lessons : [];
    for (const lesson of lessons) {
      const event = renderLesson(lesson);
      // Lessons form a series only if they look identical in the calendar,
      // so no occurrence shows another lesson's place, teacher or link
      const key = [event.start, event.end, event.summary, event.description, event.location, event.url].join("__");
      if (!groups.has(key)) groups.set(key, { event, occurrences: [], sample: lesson });
      groups.get(key).occurrences.push({ date, lesson });
    }
  }

  for (const [key, group] of groups) {
    const { event, occurrences, sample } = group;
    const { start, end, summary, description, location, url, category, colorHex } = event;
    occurrences.sort((a, b) => a.date.localeCompare(b.date));

    if (occurrences.length <= 1) {
      const { date } = occurrences[0];
      const uid = `${(sample.pair_id || cryptoRandom())}@itmo.ru`;
      const dtstart = toIsoLocal(date, start);
      const dtend = toIsoLocal(date, end);
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${nowIso}`);
      lines.push(`DTSTART:${dtstart}`);
      lines.push(`DTEND:${dtend}`);
      lines.push(`SUMMARY:${summary}`);
      lines.push(`DESCRIPTION:${description}`);
      if (location) lines.push(`LOCATION:${location}`);
      if (url) lines.push(`URL:${url}`);
      if (category) lines.push(`CATEGORIES:${escapeText(category)},ITMO`);
      if (colorHex) lines.push(`COLOR:${colorHex}`);
      lines.push("END:VEVENT");
      continue;
    }

    const firstDate = occurrences[0].date;
    const lastDate = occurrences[occurrences.length - 1].date;
    const bydaySet = new Set(occurrences.map(o => weekdayToken(o.date)));
    const byday = Array.from(bydaySet).sort().join(",");
    const dtstart0 = toIsoLocal(firstDate, start);
    const dtend0 = toIsoLocal(firstDate, end);
    const until = toIsoLocal(lastDate, end).replace(/^(DTSTART:|DTEND:)/, "");
    const expectedDates = enumerateExpectedDates(firstDate, lastDate, bydaySet);
    const actualSet = new Set(occurrences.map(o => o.date));
    const missingDates = expectedDates.filter(d => !actualSet.has(d));
    const uid = `recurr-${hashKey(key)}@itmo.ru`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowIso}`);
    lines.push(`DTSTART:${dtstart0}`);
    lines.push(`DTEND:${dtend0}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    if (location) lines.push(`LOCATION:${location}`);
    if (url) lines.push(`URL:${url}`);
    if (category) lines.push(`CATEGORIES:${escapeText(category)},ITMO`);
    if (colorHex) lines.push(`COLOR:${colorHex}`);
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${byday};UNTIL=${until}`);
    for (const d of missingDates) {
      const ex = toIsoLocal(d, start);
      lines.push(`EXDATE:${ex}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\n");
}

function renderLesson(lesson) {
  const subject = firstNonEmpty([lesson.subject, lesson.subject_id, lesson.subject_name, lesson.title, lesson.name, lesson.discipline]) || "Lesson";
  const type = (lesson.type || lesson.work_type) || "";
  const typeSuffix = type ? ` — ${String(type).trim()}` : "";
  const conference = findConference(lesson);
  const descriptionText = [
    conference.url ? `Ссылка: ${conference.url}` : "",
    conference.password ? `Пароль: ${conference.password}` : "",
    conference.info ? `Подключение: ${conference.info}` : "",
    type ? `Тип: ${type}` : "",
    lesson.teacher_name ? `Преподаватель: ${lesson.teacher_name}` : "",
    lesson.group ? `Группа: ${lesson.group}` : "",
    lesson.format ? `Формат: ${lesson.format}` : "",
    lesson.room ? `Аудитория: ${lesson.room}` : "",
    lesson.note ? `Заметка: ${lesson.note}` : "",
  ].filter(Boolean).join("\n");
  const { category, colorHex } = mapLessonTypeToCategoryAndColor(type);
  return {
    start: String(lesson.time_start || "").trim(),
    end: String(lesson.time_end || "").trim(),
    summary: escapeText(`${subject}${typeSuffix}`),
    description: escapeText(descriptionText),
    // A physical place wins; the conference link becomes the location only for lessons without one
    location: escapeText(lesson.building || lesson.room || conference.url || lesson.format || ""),
    url: conference.url,
    category,
    colorHex,
  };
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

// Any conference link (ktalk, zoom, ...): zoom_url first, then a URL written in zoom_info or note
function findConference(lesson) {
  const url = [lesson?.zoom_url, lesson?.zoom_info, lesson?.note]
    .map((v) => String(v || "").match(/https?:\/\/[^\s,;]+/i)?.[0])
    .find(Boolean) || "";
  const info = String(lesson?.zoom_info || "").trim();
  return {
    url,
    password: url ? String(lesson.zoom_password || "").trim() : "",
    info: url && info !== url ? info : "",
  };
}

function firstNonEmpty(values) {
  for (const v of values) {
    if (v != null) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return "";
}

function weekdayToken(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0-6, Sunday=0
  const map = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  return map[day];
}

function enumerateExpectedDates(startDateStr, endDateStr, bydaySet) {
  const start = new Date(startDateStr + "T00:00:00Z");
  const end = new Date(endDateStr + "T00:00:00Z");
  const result = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const token = ["SU","MO","TU","WE","TH","FR","SA"][d.getUTCDay()];
    if (bydaySet.has(token)) {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      result.push(`${yyyy}-${mm}-${dd}`);
    }
  }
  return result;
}

function hashKey(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

function mapLessonTypeToCategoryAndColor(typeRaw) {
  const t = String(typeRaw || "").toLowerCase().trim();
  // Russian aliases → English category + color aligned with ITMO palette
  if (!t) return { category: "Lesson", colorHex: "#1a5cff" };
  if (/(лекц|lecture)/.test(t)) return { category: "Lecture", colorHex: "#1a5cff" };
  if (/(практ|seminar|practic)/.test(t)) return { category: "Practice", colorHex: "#00b894" };
  if (/(лаб|labor)/.test(t)) return { category: "Lab", colorHex: "#6c5ce7" };
  // Before exam: "Консультация к экзамену" is a consultation, not an exam
  if (/(консульт|consult)/.test(t)) return { category: "Consultation", colorHex: "#10b981" };
  if (/(экзам|exam)/.test(t)) return { category: "Exam", colorHex: "#e74c3c" };
  if (/(зач|test|credit|pass)/.test(t)) return { category: "Test", colorHex: "#f39c12" };
  return { category: "Lesson", colorHex: "#2d3436" };
}


