if (window.__NAMEPASTE_HELPER_LOADED__) {
  console.log("[NamePaste Helper] already loaded, skipping duplicate init");
} else {
  window.__NAMEPASTE_HELPER_LOADED__ = true;

  (() => {
    const PREFIX = "[NamePaste Helper]";
    const UI_ID = "__namepaste_helper_btn__";
    const TOAST_ID = "__namepaste_helper_toast__";
    const DEBUG = false;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function log(...args) {
      if (DEBUG) console.log(PREFIX, ...args);
    }

    function warn(...args) {
      console.warn(PREFIX, ...args);
    }

    function error(...args) {
      console.error(PREFIX, ...args);
    }

    function norm(v) {
      return (v || "").replace(/\s+/g, " ").trim();
    }

    function low(v) {
      return norm(v).toLowerCase();
    }

    function hasChromeRuntime() {
      try {
        return typeof chrome !== "undefined" && !!chrome.runtime && !!chrome.runtime.id;
      } catch {
        return false;
      }
    }

    function hasChromeStorage() {
      try {
        return (
          typeof chrome !== "undefined" &&
          !!chrome.storage &&
          (!!chrome.storage.sync || !!chrome.storage.local)
        );
      } catch {
        return false;
      }
    }

    function isExtensionContextInvalid(err) {
      return String(err || "").toLowerCase().includes("extension context invalidated");
    }

    function isVisible(el) {
      if (!el || !(el instanceof Element)) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 2 &&
        rect.height > 2 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    }

    function describe(el) {
      if (!el) return "null";
      return {
        tag: el.tagName?.toLowerCase(),
        id: el.id || "",
        className:
          typeof el.className === "string"
            ? el.className.split(/\s+/).slice(0, 6).join(" ")
            : "",
        text: norm(el.innerText || el.textContent || "").slice(0, 140),
        aria: el.getAttribute?.("aria-label") || ""
      };
    }

    async function waitFor(fn, label, timeout = 10000, interval = 150) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        try {
          const v = fn();
          if (v) {
            if (v instanceof Element) log("waitFor success:", label, describe(v));
            return v;
          }
        } catch (e) {
          log("waitFor retry error:", label, e);
        }
        await sleep(interval);
      }
      log("waitFor timeout:", label);
      return null;
    }

    function showToast(msg) {
      const old = document.getElementById(TOAST_ID);
      if (old) old.remove();

      const div = document.createElement("div");
      div.id = TOAST_ID;
      div.textContent = msg;
      div.style.position = "fixed";
      div.style.left = "24px";
      div.style.bottom = "24px";
      div.style.zIndex = "2147483647";
      div.style.background = "#fff";
      div.style.color = "#111";
      div.style.border = "1px solid #ddd";
      div.style.borderRadius = "10px";
      div.style.padding = "10px 12px";
      div.style.fontSize = "12px";
      div.style.fontWeight = "700";
      div.style.fontFamily = "Arial, sans-serif";
      div.style.boxShadow = "0 8px 24px rgba(0,0,0,.15)";
      document.body.appendChild(div);

      setTimeout(() => {
        if (div?.parentNode) div.remove();
      }, 2200);
    }

    function storageArea() {
      try {
        if (!hasChromeStorage()) return null;
        if (chrome.storage.sync) return chrome.storage.sync;
        if (chrome.storage.local) return chrome.storage.local;
        return null;
      } catch {
        return null;
      }
    }

    function storageGet(defaults) {
      const area = storageArea();
      if (!area) return Promise.resolve({ ...(defaults || {}) });

      return new Promise((resolve) => {
        try {
          area.get(defaults || {}, (res) => {
            try {
              if (typeof chrome !== "undefined" && chrome.runtime?.lastError) {
                resolve({ ...(defaults || {}) });
                return;
              }
            } catch { }
            resolve({ ...(defaults || {}), ...(res || {}) });
          });
        } catch {
          resolve({ ...(defaults || {}) });
        }
      });
    }

    function storageSet(obj) {
      const area = storageArea();
      if (!area) return Promise.resolve();

      return new Promise((resolve) => {
        try {
          area.set(obj || {}, () => resolve());
        } catch {
          resolve();
        }
      });
    }

    async function copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.left = "-99999px";
          ta.style.top = "-99999px";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          const ok = document.execCommand("copy");
          ta.remove();
          return !!ok;
        } catch {
          return false;
        }
      }
    }

    function clickLikeUser(el, label = "click") {
      if (!el) return false;

      log("clickLikeUser", label, describe(el));

      try {
        el.scrollIntoView({ block: "center", inline: "center" });
      } catch { }

      try {
        el.focus?.();
      } catch { }

      try {
        el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
      } catch { }

      try {
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        return true;
      } catch { }

      try {
        el.click();
        return true;
      } catch {
        return false;
      }
    }

    function getText(el) {
      return low(el?.innerText || el?.textContent || "");
    }

    function getAria(el) {
      return low(el?.getAttribute?.("aria-label") || "");
    }

    function collectRoots(start = document) {
      const roots = [];
      const seen = new Set();

      function visit(node) {
        if (!node || seen.has(node)) return;
        seen.add(node);
        roots.push(node);

        let elements = [];
        try {
          if (
            node instanceof Document ||
            node instanceof ShadowRoot ||
            node instanceof Element
          ) {
            elements = Array.from(node.querySelectorAll("*"));
          }
        } catch { }

        for (const el of elements) {
          try {
            if (el.shadowRoot) visit(el.shadowRoot);
          } catch { }
        }
      }

      visit(start);
      return roots;
    }

    function queryAllDeep(selector, start = document) {
      const out = [];
      const roots = collectRoots(start);

      for (const root of roots) {
        try {
          out.push(...Array.from(root.querySelectorAll(selector)));
        } catch { }
      }

      return out;
    }

    function getProfileName() {
      const selectors = [
        "main h1",
        "[role='main'] h1",
        ".pv-text-details__left-panel h1",
        ".ph5 h1"
      ];

      for (const sel of selectors) {
        const els = queryAllDeep(sel).filter(isVisible);
        for (const el of els) {
          const txt = norm(el.textContent);
          if (!txt) continue;
          if (txt.length < 2 || txt.length > 120) continue;
          return txt;
        }
      }

      const title = norm(document.title);
      if (title.includes("|")) {
        const name = norm(title.split("|")[0]);
        if (name) return name;
      }

      return "";
    }

    function firstNameFromFull(fullName) {
      const cleaned = norm(fullName).split("(")[0].split(",")[0].trim();
      return cleaned.split(/\s+/).filter(Boolean)[0] || "";
    }

    function buildMessage(template, fullName) {
      const full = norm(fullName);
      const first = firstNameFromFull(full) || "there";
      const message = (template || "")
        .replace(/\{FirstName\}/g, first)
        .replace(/\{Name\}/g, first)
        .replace(/\{FullName\}/g, full)
        .trim();

      return { full, first, message };
    }

    function getPrimaryProfileSection() {
      const candidates = queryAllDeep("main section, .pv-top-card, .artdeco-card").filter(isVisible);
      const profileName = low(getProfileName());

      let best = null;
      let bestScore = -Infinity;

      for (const el of candidates) {
        const text = getText(el);
        const rect = el.getBoundingClientRect();
        let score = 0;

        if (profileName && text.includes(profileName)) score += 100;
        if (text.includes("message")) score += 20;
        if (text.includes("follow")) score += 20;
        if (text.includes("connect")) score += 40;
        if (text.includes("more")) score += 20;
        if (text.includes("about")) score -= 80;
        if (text.includes("activity")) score -= 80;
        if (text.includes("featured")) score -= 120;
        if (rect.top >= -100 && rect.top < 500) score += 50;

        if (score > bestScore) {
          bestScore = score;
          best = el;
        }
      }

      return best;
    }

    function getClickableCandidates(root = document) {
      return queryAllDeep("button, a, [role='button'], [role='menuitem']", root).filter(isVisible);
    }

    function isConnectElement(el) {
      const text = getText(el);
      const aria = getAria(el);
      const href = low(el.getAttribute?.("href") || "");

      const positive =
        text === "connect" ||
        text.startsWith("connect") ||
        text.includes("connect") ||
        text.includes("invite") ||
        aria.includes("connect") ||
        aria.includes("invite") ||
        href.includes("/preload/custom-invite/");

      const negative =
        text.includes("message") ||
        text.includes("follow") ||
        text.includes("remove") ||
        text.includes("pending") ||
        text.includes("accept") ||
        text.includes("send without a note") ||
        text.includes("add a note") ||
        aria.includes("message") ||
        aria.includes("follow");

      return positive && !negative;
    }

    function isMoreElement(el) {
      const text = getText(el);
      const aria = getAria(el);
      return (
        text === "more" ||
        text.includes("more") ||
        text === "…" ||
        text === "..." ||
        aria === "more" ||
        aria.includes("more actions")
      );
    }

    function findDirectConnectButton() {
      const section = getPrimaryProfileSection();
      const roots = [section, document].filter(Boolean);

      for (const root of roots) {
        const candidates = getClickableCandidates(root);
        for (const el of candidates) {
          if (isConnectElement(el)) return el;
        }
      }

      return null;
    }

    function findMoreButton() {
      const section = getPrimaryProfileSection();
      const roots = [section, document].filter(Boolean);

      for (const root of roots) {
        const candidates = getClickableCandidates(root);
        for (const el of candidates) {
          if (isMoreElement(el)) return el;
        }
      }

      return null;
    }

    function getVisibleMenus() {
      return queryAllDeep(
        '[role="menu"], .artdeco-dropdown__content, .artdeco-dropdown__content-inner, .artdeco-dropdown'
      ).filter(isVisible);
    }

    function findConnectInMenu(menu) {
      if (!menu) return null;

      const items = getClickableCandidates(menu);

      for (const el of items) {
        const text = getText(el);
        const aria = getAria(el);
        const href = low(el.getAttribute?.("href") || "");

        if (
          href.includes("/preload/custom-invite/") ||
          text === "connect" ||
          text.includes("connect") ||
          aria.includes("connect") ||
          aria.includes("invite")
        ) {
          return el;
        }
      }

      return null;
    }

    function findInviteModalRoot() {
      const selectors = [
        '[data-test-modal-id="send-invite-modal"]',
        '[data-test-modal-container][data-test-modal-id="send-invite-modal"]',
        '.artdeco-modal.send-invite',
        '[role="dialog"]'
      ];

      for (const sel of selectors) {
        const nodes = queryAllDeep(sel).filter(isVisible);
        if (nodes.length) return nodes[0];
      }

      return null;
    }

    function findAddNoteButtonExact() {
      const root = findInviteModalRoot() || document;

      const selectors = [
        '.artdeco-modal__actionbar button[aria-label="Add a note"]',
        'button[aria-label="Add a note"]'
      ];

      for (const sel of selectors) {
        const nodes = queryAllDeep(sel, root).filter(isVisible);
        if (nodes.length) return nodes[0];
      }

      return null;
    }

    function findSendWithoutNoteButtonExact() {
      const root = findInviteModalRoot() || document;

      const selectors = [
        '.artdeco-modal__actionbar button[aria-label="Send without a note"]',
        'button[aria-label="Send without a note"]'
      ];

      for (const sel of selectors) {
        const nodes = queryAllDeep(sel, root).filter(isVisible);
        if (nodes.length) return nodes[0];
      }

      return null;
    }

    function findTextarea() {
      const root = findInviteModalRoot() || document;

      const selectors = [
        "#custom-message",
        'textarea[name="message"]',
        'textarea[placeholder*="We know each other from"]',
        "textarea"
      ];

      for (const sel of selectors) {
        const nodes = queryAllDeep(sel, root).filter(isVisible);
        if (nodes.length) return nodes[0];
      }

      return null;
    }

    function setNativeTextareaValue(textarea, value) {
      textarea.focus();

      const prototype = window.HTMLTextAreaElement.prototype;
      const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

      if (valueSetter) valueSetter.call(textarea, value);
      else textarea.value = value;

      try {
        textarea.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            data: value,
            inputType: "insertText"
          })
        );
      } catch {
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }

      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      textarea.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
      textarea.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));
      textarea.focus();
    }

    async function openConnectFlow() {
      const direct = findDirectConnectButton();
      if (direct) {
        clickLikeUser(direct, "direct-connect");
        return true;
      }

      const more = findMoreButton();
      if (!more) {
        showToast("No Connect button found");
        return false;
      }

      clickLikeUser(more, "more-button");

      const menu = await waitFor(
        () => {
          const menus = getVisibleMenus();
          for (const m of menus) {
            const item = findConnectInMenu(m);
            if (item) return m;
          }
          return null;
        },
        "visible-menu-with-connect",
        5000,
        120
      );

      if (!menu) {
        showToast("More menu opened, but Connect not found");
        return false;
      }

      const connectItem = findConnectInMenu(menu);
      if (!connectItem) {
        showToast("Connect not found in menu");
        return false;
      }

      clickLikeUser(connectItem, "menu-connect");
      return true;
    }

    async function ensureInviteTextareaOpen() {
      let textarea = findTextarea();
      if (textarea) return textarea;

      const firstState = await waitFor(
        () => {
          const ta = findTextarea();
          if (ta) return { type: "textarea", el: ta };

          const addBtn = findAddNoteButtonExact();
          if (addBtn) return { type: "addNote", el: addBtn };

          const noNoteBtn = findSendWithoutNoteButtonExact();
          if (noNoteBtn) return { type: "sendWithout", el: noNoteBtn };

          return null;
        },
        "linkedin-send-invite-state",
        12000,
        150
      );

      if (!firstState) return null;

      if (firstState.type === "textarea") {
        return firstState.el;
      }

      const addBtn = findAddNoteButtonExact();
      if (addBtn) {
        clickLikeUser(addBtn, "add-note-button");
        await sleep(1200);

        textarea = await waitFor(() => findTextarea(), "linkedin-note-textarea", 12000, 150);
        return textarea;
      }

      return null;
    }

    async function pasteMessage(message) {
      const textarea = await ensureInviteTextareaOpen();
      if (!textarea) {
        showToast("Invitation text box not found");
        return false;
      }

      setNativeTextareaValue(textarea, message);
      await sleep(350);

      let ok = norm(textarea.value) === norm(message);

      if (!ok) {
        textarea.focus();
        textarea.select?.();
        try {
          document.execCommand("insertText", false, message);
        } catch { }
        await sleep(350);
        ok = norm(textarea.value) === norm(message);
      }

      if (!ok) {
        textarea.value = "";
        setNativeTextareaValue(textarea, message);
        await sleep(350);
        ok = norm(textarea.value) === norm(message);
      }

      return ok;
    }

    async function runFlow(message) {
      const alreadyOpen = findTextarea();
      if (!alreadyOpen) {
        const opened = await openConnectFlow();
        if (!opened) return false;
        await sleep(1000);
      }

      return pasteMessage(message);
    }

    function shouldShowButton() {
      return /linkedin\.com\/in\//i.test(location.href);
    }

    function styleButton(btn) {
      btn.style.position = "fixed";
      btn.style.left = "24px";
      btn.style.top = "50%";
      btn.style.transform = "translateY(-50%)";
      btn.style.zIndex = "2147483647";
      btn.style.background = "#6366f1";
      btn.style.color = "#fff";
      btn.style.border = "none";
      btn.style.borderRadius = "10px";
      btn.style.padding = "10px 14px";
      btn.style.fontSize = "12px";
      btn.style.fontWeight = "700";
      btn.style.fontFamily = "Arial, sans-serif";
      btn.style.cursor = "pointer";
      btn.style.boxShadow = "0 8px 24px rgba(0,0,0,.18)";
    }

    async function generateMessageFromStorage() {
      const { enabled = true, template = "" } = await storageGet({
        enabled: true,
        template: ""
      });

      if (!enabled) {
        showToast("Extension disabled");
        return null;
      }

      if (!template.trim()) {
        showToast("Save a template first");
        return null;
      }

      const fullName = getProfileName();
      if (!fullName) {
        showToast("Profile name not found");
        return null;
      }

      const built = buildMessage(template, fullName);

      await storageSet({
        latest_full_name: built.full,
        latest_first_name: built.first,
        latest_message: built.message,
        latest_updated_at: new Date().toISOString()
      });

      return built;
    }

    async function handleAutofillMessage(message) {
      if (!message || !norm(message)) {
        showToast("Message is empty");
        return { ok: false, reason: "empty_message" };
      }

      await copyToClipboard(message);
      const ok = await runFlow(message);

      if (ok) {
        showToast("Message pasted");
        return { ok: true };
      }

      showToast("Could not paste message");
      return { ok: false, reason: "flow_failed" };
    }

    function createButton() {
      const btn = document.createElement("button");
      btn.id = UI_ID;
      btn.type = "button";
      btn.textContent = "Copy & Paste";
      btn.setAttribute("aria-label", "Copy and paste personalized message");
      styleButton(btn);

      btn.addEventListener("click", async () => {
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Working...";
        btn.style.opacity = "0.8";

        try {
          const built = await generateMessageFromStorage();
          if (!built) return;

          await handleAutofillMessage(built.message);
        } catch (e) {
          error("Fatal click error", e);

          if (isExtensionContextInvalid(e)) {
            showToast("Extension reloaded. Refresh this page.");
          } else {
            showToast("Script error");
          }
        } finally {
          btn.disabled = false;
          btn.textContent = oldText;
          btn.style.opacity = "1";
        }
      });

      return btn;
    }

    function ensureButton() {
      const existing = document.getElementById(UI_ID);

      if (!shouldShowButton()) {
        if (existing) existing.remove();
        return;
      }

      if (existing) return;
      if (!document.body) return;

      const btn = createButton();
      document.body.appendChild(btn);
    }

    async function updatePreview() {
      const { enabled = true, template = "" } = await storageGet({
        enabled: true,
        template: ""
      });

      const fullName = getProfileName();
      const { message, full, first } = buildMessage(template, fullName);

      await storageSet({
        latest_full_name: full,
        latest_first_name: first,
        latest_message: enabled ? message : "",
        latest_updated_at: new Date().toISOString()
      });
    }

    function installMessageListener() {
      try {
        if (typeof chrome === "undefined") return;
        if (!chrome.runtime || !chrome.runtime.onMessage) return;
        if (window.__NAMEPASTE_LISTENER_INSTALLED__) return;

        window.__NAMEPASTE_LISTENER_INSTALLED__ = true;

        chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
          if (!req || typeof req !== "object") return;

          if (req.type === "NAMEPASTE_AUTOFILL") {
            (async () => {
              try {
                const message = norm(req.message || "");
                const result = await handleAutofillMessage(message);
                sendResponse(result);
              } catch (e) {
                if (isExtensionContextInvalid(e)) {
                  sendResponse({ ok: false, reason: "refresh_required" });
                } else {
                  sendResponse({ ok: false, reason: "exception", error: String(e) });
                }
              }
            })();

            return true;
          }
        });
      } catch { }
    }

    function observeUrlChanges() {
      let lastHref = location.href;

      const observer = new MutationObserver(() => {
        if (location.href !== lastHref) {
          lastHref = location.href;
          setTimeout(() => {
            ensureButton();
            updatePreview().catch(() => { });
          }, 500);
        }
      });

      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });
    }

    function exposeDebugApi() {
      window.__namePasteHelper = {
        getProfileName,
        findDirectConnectButton,
        findMoreButton,
        findInviteModalRoot,
        findAddNoteButtonExact,
        findSendWithoutNoteButtonExact,
        findTextarea,
        queryAllDeep,
        runTest: async () => {
          const built = await generateMessageFromStorage();
          if (!built) return false;
          const res = await handleAutofillMessage(built.message);
          return res.ok;
        }
      };
    }

    async function boot() {
      await waitFor(() => document.body, "document.body", 8000, 50);
      ensureButton();
      installMessageListener();
      observeUrlChanges();
      exposeDebugApi();
      updatePreview().catch(() => { });
    }

    boot();
  })();
}