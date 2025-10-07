function setError(message) {
  const el = document.getElementById("errorMsg");
  if (!message) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "block";
  el.textContent = String(message);
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

  if (!onMyItmo) {
    notice.style.display = "block";
    buttons.style.display = "none";
  } else {
    notice.style.display = "none";
    buttons.style.display = "block";
  }

  // term toggle handlers
  const btnFall = document.getElementById("btnFall");
  const btnSpring = document.getElementById("btnSpring");
  btnFall.addEventListener("click", () => {
    btnFall.classList.add("active");
    btnSpring.classList.remove("active");
  });
  btnSpring.addEventListener("click", () => {
    btnSpring.classList.add("active");
    btnFall.classList.remove("active");
  });
}

document.addEventListener("DOMContentLoaded", initHostGate);

async function downloadFlow() {
  const btn = document.getElementById("btnDownloadAll");
  const separate = document.getElementById("chkSeparateByType").checked;
  const term = document.getElementById("btnFall").classList.contains("active") ? "fall" : "spring";
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Please wait";
  try {
    setError("");
    console.log("[popup] Reading tokens from my.itmo.ru ...");
    const t = await sendMessage({ type: "GET_TOKENS" });
    if (!t?.ok) throw new Error(t?.error || "Failed to get tokens");

    console.log("[popup] Fetching schedule ...", { term });
    const s = await sendMessage({ type: "GET_SCHEDULE", term });
    if (!s?.ok) throw new Error(s?.error || "Failed to fetch schedule");

    console.log("[popup] Generating iCal ...", { separate });
    const g = await sendMessage({ type: separate ? "GENERATE_ICAL_SEPARATED" : "GENERATE_ICAL" });
    if (!g?.ok) throw new Error(g?.error || "Failed to generate iCal");

    console.log("[popup] Preparing download ...");
    if (!separate) {
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
      console.log("[popup] Downloaded single file");
    } else {
      const d = await sendMessage({ type: "DOWNLOAD_ICAL_SEPARATED" });
      if (!d?.ok || !Array.isArray(d.files)) throw new Error(d?.error || "Failed to prepare separated files");
      for (let i = 0; i < d.files.length; i++) {
        const file = d.files[i];
        const blob = new Blob([file.content], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        // Delay between downloads to prevent browser throttling
        if (i < d.files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      console.log("[popup] Downloaded files:", d.files.map(f => f.name));
    }
  } catch (e) {
    console.error("[popup] Error:", e);
    setError(String(e?.message || e));
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

document.getElementById("btnDownloadAll").addEventListener("click", downloadFlow);


