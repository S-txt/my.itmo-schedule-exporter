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
})();


