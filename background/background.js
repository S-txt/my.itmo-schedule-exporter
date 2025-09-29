import { getSemesterDates } from "../utils/date-utils.js";
import { fetchPersonalSchedule } from "../utils/api-client.js";
import { scheduleToICS } from "../utils/calendar-generator.js";

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs && tabs.length > 0 ? tabs[0].id : undefined;
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content/content.js"],
    world: "ISOLATED",
  });
}

async function readTokensDirectly(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "ISOLATED",
    func: () => {
      try {
        return {
          token: window.localStorage.getItem("auth._token.itmoId"),
          expiration: window.localStorage.getItem("auth._token_expiration.itmoId"),
        };
      } catch (e) {
        return { token: null, expiration: null, error: String(e?.message || e) };
      }
    },
  });
  return result;
}

async function readTokensFromContentScript() {
  const tabId = await getActiveTabId();
  if (!tabId) throw new Error("No active tab found");

  // First attempt: message existing content script
  try {
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: "READ_TOKENS" }, (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(resp);
      });
    });
    if (response) return response;
  } catch (_e) {
    // proceed to injection fallback
  }

  // Second attempt: inject content script then retry messaging
  try {
    await injectContentScript(tabId);
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: "READ_TOKENS" }, (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(resp);
      });
    });
    if (response) return response;
  } catch (_e) {
    // proceed to direct execution fallback
  }

  // Final attempt: directly read localStorage via injected function
  const direct = await readTokensDirectly(tabId);
  return direct;
}

function isTokenValid(expirationMsString) {
  if (!expirationMsString) return false;
  const expirationMs = Number(expirationMsString);
  if (!Number.isFinite(expirationMs)) return false;
  const now = Date.now();
  const safetyMarginMs = 60 * 1000; // 1 minute margin
  return expirationMs - safetyMarginMs > now;
}

async function saveTokensToStorage(token, expirationMsString) {
  await chrome.storage.local.set({ itmoToken: token || null, itmoTokenExpirationMs: expirationMsString || null });
}

async function getStoredToken() {
  const { itmoToken, itmoTokenExpirationMs } = await chrome.storage.local.get(["itmoToken", "itmoTokenExpirationMs"]);
  return { token: itmoToken, expirationMsString: itmoTokenExpirationMs };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    if (request?.type === "GET_TOKENS") {
      try {
        const result = await readTokensFromContentScript();
        const token = result?.token || null;
        const expiration = result?.expiration || null;

        const valid = isTokenValid(expiration);
        await saveTokensToStorage(token, expiration);

        sendResponse({ ok: true, token, expiration, valid });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
      return;
    }

    if (request?.type === "GET_SCHEDULE") {
      try {
        const { token, expirationMsString } = await getStoredToken();
        if (!token || !isTokenValid(expirationMsString)) {
          sendResponse({ ok: false, error: "Missing or expired token" });
          return;
        }
        const { start, end } = getSemesterDates();
        const schedule = await fetchPersonalSchedule(token, start, end);
        await chrome.storage.local.set({ itmoSchedule: schedule, itmoScheduleWindow: { start, end } });
        sendResponse({ ok: true, start, end, count: Array.isArray(schedule?.data) ? schedule.data.length : 0 });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
      return;
    }

    if (request?.type === "GENERATE_ICAL") {
      try {
        const { itmoSchedule } = await chrome.storage.local.get(["itmoSchedule"]);
        if (!itmoSchedule) {
          sendResponse({ ok: false, error: "Schedule is empty" });
          return;
        }
        const ics = scheduleToICS(itmoSchedule);
        await chrome.storage.local.set({ itmoIcsContent: ics });
        sendResponse({ ok: true, size: ics.length });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
      return;
    }

    if (request?.type === "DOWNLOAD_ICAL") {
      try {
        const { itmoIcsContent } = await chrome.storage.local.get(["itmoIcsContent"]);
        if (!itmoIcsContent) {
          sendResponse({ ok: false, error: "No iCal content found" });
          return;
        }
        sendResponse({ ok: true, ics: itmoIcsContent });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
      return;
    }

    // Unknown message
    sendResponse({ ok: false, error: "Unknown request type" });
  })();
  return true; // keep the message channel open for async responses
});


