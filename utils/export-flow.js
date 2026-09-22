// Export flow shared by the popup and the in-page button on /schedule.
// Loaded as a classic script in both places, so it exposes a global instead of ES exports.
globalThis.ItmoExport = (() => {
  async function request(message, errorText) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || errorText);
    return response;
  }

  async function downloadFiles(files) {
    for (let i = 0; i < files.length; i++) {
      const blob = new Blob([files[i].content], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = files[i].name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // Delay between downloads to prevent browser throttling (Brave-like browsers drop them otherwise)
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  async function exportSchedule({ term, separate }) {
    console.log("[ITMO export] Reading tokens from my.itmo.ru ...");
    await request({ type: "GET_TOKENS" }, "Failed to get tokens");

    console.log("[ITMO export] Fetching schedule ...", { term });
    await request({ type: "GET_SCHEDULE", term }, "Failed to fetch schedule");

    console.log("[ITMO export] Generating iCal ...", { separate });
    await request({ type: separate ? "GENERATE_ICAL_SEPARATED" : "GENERATE_ICAL" }, "Failed to generate iCal");

    let files;
    if (separate) {
      const d = await request({ type: "DOWNLOAD_ICAL_SEPARATED" }, "Failed to prepare separated files");
      if (!Array.isArray(d.files)) throw new Error("Failed to prepare separated files");
      files = d.files;
    } else {
      const d = await request({ type: "DOWNLOAD_ICAL" }, "Failed to prepare download");
      files = [{ name: "itmo-schedule.ics", content: d.ics }];
    }

    await downloadFiles(files);
    console.log("[ITMO export] Downloaded files:", files.map(f => f.name));
    return files;
  }

  return { exportSchedule };
})();
