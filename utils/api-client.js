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
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "en",
            Referer: "https://my.itmo.ru/schedule?date=" + dateStart,
            "X-Request-ID": crypto.randomUUID(),
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            Priority: "u=1, i",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
          },
          credentials: "include",
        });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 300)}`);
  }
  return await resp.json();
}


