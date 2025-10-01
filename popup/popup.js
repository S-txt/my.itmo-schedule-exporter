function setStatus(text) {
  const el = document.getElementById("status");
  el.textContent = typeof text === "string" ? text : JSON.stringify(text, null, 2);
}

async function sendMessage(request) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(request, (response) => {
      resolve(response);
    });
  });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs && tabs.length ? tabs[0] : null;
}

async function initHostGate() {
  const tab = await getActiveTab();
  const onMyItmo = !!tab?.url && tab.url.includes("my.itmo.ru");
  const notice = document.getElementById("notOnMyItmo");
  const buttons = document.querySelector(".buttons");
  const status = document.getElementById("status");

  if (!onMyItmo) {
    notice.style.display = "block";
    buttons.style.display = "none";
    status.style.display = "none";
  } else {
    notice.style.display = "none";
    buttons.style.display = "block";
    status.style.display = "block";
  }
}

document.addEventListener("DOMContentLoaded", initHostGate);

async function downloadFlow() {
  const btn = document.getElementById("btnDownloadAll");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Please wait";
  try {
    setStatus("Reading tokens from my.itmo.ru ...");
    const t = await sendMessage({ type: "GET_TOKENS" });
    if (!t?.ok) throw new Error(t?.error || "Failed to get tokens");

    setStatus("Fetching schedule ...");
    const s = await sendMessage({ type: "GET_SCHEDULE" });
    if (!s?.ok) throw new Error(s?.error || "Failed to fetch schedule");

    setStatus("Generating iCal ...");
    const g = await sendMessage({ type: "GENERATE_ICAL" });
    if (!g?.ok) throw new Error(g?.error || "Failed to generate iCal");

    setStatus("Preparing download ...");
    const d = await sendMessage({ type: "DOWNLOAD_ICAL" });
    if (!d?.ok) throw new Error(d?.error || "Failed to prepare download");

    const blob = new Blob([d.ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "itmo-schedule.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus({ ok: true, downloaded: true });
  } catch (e) {
    setStatus({ ok: false, error: String(e?.message || e) });
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

document.getElementById("btnDownloadAll").addEventListener("click", downloadFlow);


