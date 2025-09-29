const BASE_URL = "https://my.itmo.ru/api/schedule/schedule/personal";

export async function fetchPersonalSchedule(bearerToken, dateStart, dateEnd) {
  if (!bearerToken?.startsWith("Bearer ")) {
    throw new Error("Expected Bearer token prefix");
  }
  const url = new URL(BASE_URL);
  url.searchParams.set("date_start", dateStart);
  url.searchParams.set("date_end", dateEnd);

  const resp = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: bearerToken,
      Accept: "application/json",
    },
    credentials: "include",
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 300)}`);
  }
  return await resp.json();
}


