(function() {
  function readLocalStorageSafe(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_e) {
      return null;
    }
  }

  function getTokensFromLocalStorage() {
    const token = readLocalStorageSafe("auth._token.itmoId");
    const expiration = readLocalStorageSafe("auth._token_expiration.itmoId");
    return { token, expiration };
  }

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.type === "READ_TOKENS") {
      const { token, expiration } = getTokensFromLocalStorage();
      sendResponse({ token, expiration });
      return true;
    }
    return false;
  });

  // Check if we are on the /schedule page
  function isSchedulePage() {
    return window.location.pathname === "/schedule";
  }

  // Create download button
  function createDownloadButton() {
    const button = document.createElement("button");
    button.id = "itmo-extension-download-btn";
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 16L7 11L8.4 9.55L11 12.15V4H13V12.15L15.6 9.55L17 11L12 16Z" fill="currentColor"/>
        <path d="M20 18H4V20H20V18Z" fill="currentColor"/>
      </svg>
    `;
    button.addEventListener("click", toggleDropdown);
    return button;
  }

  // Create dropdown menu
  function createDropdown() {
    const dropdown = document.createElement("div");
    dropdown.id = "itmo-extension-dropdown";
    dropdown.innerHTML = `
      <button class="itmo-extension-dropdown-item" data-action="single">
        <span>Single file</span>
      </button>
      <button class="itmo-extension-dropdown-item" data-action="separated">
        <span>By type</span>
      </button>
    `;

    // Add click handlers
    dropdown.querySelectorAll(".itmo-extension-dropdown-item").forEach(item => {
      item.addEventListener("click", (e) => {
        const action = e.currentTarget.getAttribute("data-action");
        handleDownload(action);
        closeDropdown();
      });
    });

    return dropdown;
  }

  // Open dropdown
  function openDropdown() {
    let dropdown = document.getElementById("itmo-extension-dropdown");
    if (!dropdown) {
      dropdown = createDropdown();
      document.body.appendChild(dropdown);
    }

    const button = document.getElementById("itmo-extension-download-btn");
    if (!button) return;

    const rect = button.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;

    dropdown.classList.add("show");
  }

  // Close dropdown
  function closeDropdown() {
    const dropdown = document.getElementById("itmo-extension-dropdown");
    if (dropdown) {
      dropdown.classList.remove("show");
    }
  }

  // Toggle dropdown
  function toggleDropdown() {
    const dropdown = document.getElementById("itmo-extension-dropdown");
    if (dropdown && dropdown.classList.contains("show")) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  // Determine current semester based on date
  function getCurrentSemester() {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12

    // August (8) - January (1): Fall semester
    // February (2) - July (7): Spring semester
    // With 1 month buffer before next semester starts:
    // - In July (7): switch to Fall
    // - In January (1): switch to Spring

    if (month >= 7 && month <= 12) {
      return "fall";
    } else if (month >= 1 && month <= 6) {
      return "spring";
    }

    return "fall"; // Default fallback
  }

  // Set button loading state
  function setButtonLoading(isLoading) {
    const button = document.getElementById("itmo-extension-download-btn");
    if (!button) return;

    if (isLoading) {
      button.disabled = true;
      button.innerHTML = `
        <svg class="itmo-extension-loader" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"/>
          <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
        </svg>
      `;
    } else {
      button.disabled = false;
      button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 16L7 11L8.4 9.55L11 12.15V4H13V12.15L15.6 9.55L17 11L12 16Z" fill="currentColor"/>
          <path d="M20 18H4V20H20V18Z" fill="currentColor"/>
        </svg>
      `;
    }
  }

  // Handle download action
  async function handleDownload(action) {
    setButtonLoading(true);

    try {
      // Check if extension context is valid
      if (!chrome.runtime?.id) {
        return;
      }

      // Get tokens
      const tokensResponse = await chrome.runtime.sendMessage({ type: "GET_TOKENS" });
      if (!tokensResponse?.ok) {
        return;
      }

      // Determine semester automatically
      const term = getCurrentSemester();

      // Get schedule
      const scheduleResponse = await chrome.runtime.sendMessage({ type: "GET_SCHEDULE", term });
      if (!scheduleResponse?.ok) {
        return;
      }

      if (action === "single") {
        // Single file
        const icsResponse = await chrome.runtime.sendMessage({ type: "GENERATE_ICAL" });
        if (!icsResponse?.ok) {
          return;
        }

        const downloadResponse = await chrome.runtime.sendMessage({ type: "DOWNLOAD_ICAL" });
        if (!downloadResponse?.ok) {
          return;
        }

        const blob = new Blob([downloadResponse.ics], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "itmo-schedule.ics";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else if (action === "separated") {
        // Separated by type
        const icsResponse = await chrome.runtime.sendMessage({ type: "GENERATE_ICAL_SEPARATED" });
        if (!icsResponse?.ok) {
          return;
        }

        const downloadResponse = await chrome.runtime.sendMessage({ type: "DOWNLOAD_ICAL_SEPARATED" });
        if (!downloadResponse?.ok || !Array.isArray(downloadResponse.files)) {
          return;
        }

        for (const file of downloadResponse.files) {
          const blob = new Blob([file.content], { type: "text/calendar;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      // Silently fail - don't show errors to users
      return;
    } finally {
      setButtonLoading(false);
    }
  }

  // Insert download button on the page
  function insertDownloadButton() {
    // Search for week/month toggle
    const radioGroup = document.querySelector('[role="radiogroup"], .btn-group-toggle');

    if (radioGroup) {
      // Insert button before toggle
      const button = createDownloadButton();
      radioGroup.parentNode.insertBefore(button, radioGroup);
      return;
    }

    // Alternative search
    const headerSwitch = document.querySelector(".el-calendar-header-switch, [class*='calendar-header']");
    if (headerSwitch) {
      const button = createDownloadButton();
      headerSwitch.appendChild(button);
      return;
    }

    // Fallback option
    const cardBody = document.querySelector(".card-body");
    if (cardBody) {
      const buttonContainer = document.createElement("div");
      buttonContainer.style.marginBottom = "16px";
      buttonContainer.appendChild(createDownloadButton());
      cardBody.insertBefore(buttonContainer, cardBody.firstChild);
      return;
    }
  }

  // Remove download button
  function removeDownloadButton() {
    const button = document.getElementById("itmo-extension-download-btn");
    if (button) {
      button.remove();
    }
  }

  // Initialize on page load
  function init() {
    if (!isSchedulePage()) {
      removeDownloadButton();
      return;
    }

    // If button already exists, don't add again
    if (document.getElementById("itmo-extension-download-btn")) {
      return;
    }

    // Wait for page elements to load
    const observer = new MutationObserver(() => {
      if (document.querySelector(".card-body") && !document.getElementById("itmo-extension-download-btn")) {
        insertDownloadButton();
        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout to prevent infinite waiting
    setTimeout(() => observer.disconnect(), 10000);
  }

  // Check if we are on the target resource my.itmo.ru
  function isMyItmoSite() {
    return window.location.hostname === "my.itmo.ru";
  }

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("itmo-extension-dropdown");
    const button = document.getElementById("itmo-extension-download-btn");

    if (dropdown && dropdown.classList.contains("show")) {
      if (!dropdown.contains(e.target) && e.target !== button && !button?.contains(e.target)) {
        closeDropdown();
      }
    }
  });

  // Track URL changes for SPA navigation (only on my.itmo.ru)
  if (isMyItmoSite()) {
    let lastUrl = window.location.href;

    function checkUrlChange() {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        init();
      }
    }

    // Listen for browser history changes (for SPA)
    window.addEventListener("popstate", checkUrlChange);

    // Intercept pushState and replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      checkUrlChange();
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      checkUrlChange();
    };

    // MutationObserver to track DOM changes (in case of dynamic URL changes)
    const urlObserver = new MutationObserver(checkUrlChange);
    urlObserver.observe(document.body, { childList: true, subtree: true });

    // Run on load
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();





