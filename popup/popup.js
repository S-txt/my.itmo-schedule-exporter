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
    await ItmoExport.exportSchedule({ term, separate });
  } catch (e) {
    console.error("[popup] Error:", e);
    setError(String(e?.message || e));
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

document.getElementById("btnDownloadAll").addEventListener("click", downloadFlow);


