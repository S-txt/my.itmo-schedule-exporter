export function getSemesterDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  if (month >= 9 || month <= 1) {
    const startYear = month >= 9 ? year : year - 1;
    return { start: `${startYear}-09-01`, end: `${startYear + 1}-02-28` };
  }

  return { start: `${year}-02-01`, end: `${year}-06-30` };
}

export function getTermDates(term) {
  const now = new Date();
  const year = now.getFullYear();
  if (term === 'fall') {
    const startYear = year; // assume current year fall
    return { start: `${startYear}-09-01`, end: `${startYear + 1}-02-28` };
  }
  // spring
  return { start: `${year}-02-01`, end: `${year}-06-30` };
}

export function toIsoLocal(dateStr, timeStr) {
  // dateStr: YYYY-MM-DD, timeStr: HH:mm
  const [year, month, day] = dateStr.split("-").map((v) => Number(v));
  const [hours, minutes] = timeStr.split(":").map((v) => Number(v));
  // Moscow time UTC+3; we store as UTC by subtracting 3 hours
  const date = new Date(Date.UTC(year, month - 1, day, hours - 3, minutes, 0));
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}





