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
    buttons.style.display = "grid";
    status.style.display = "block";
  }
}

document.addEventListener("DOMContentLoaded", initHostGate);

document.getElementById("btnGetTokens").addEventListener("click", async () => {
  setStatus("Reading tokens from my.itmo.ru ...");
  const res = await sendMessage({ type: "GET_TOKENS" });
  setStatus(res);
});

document.getElementById("btnGetSchedule").addEventListener("click", async () => {
  setStatus("Fetching schedule ...");
  const res = await sendMessage({ type: "GET_SCHEDULE" });
  setStatus(res);
});

document.getElementById("btnGenerateIcal").addEventListener("click", async () => {
  setStatus("Generating iCal ...");
  const res = await sendMessage({ type: "GENERATE_ICAL" });
  setStatus(res);
});

document.getElementById("btnDownloadIcal").addEventListener("click", async () => {
  setStatus("Preparing download ...");
  const res = await sendMessage({ type: "DOWNLOAD_ICAL" });
  if (!res?.ok) {
    setStatus(res);
    return;
  }
  const blob = new Blob([res.ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "itmo-schedule.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus({ ok: true, downloaded: true });
});


