(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Config ----------
  const UI_ID = "__li_copy_paste_btn__";
  const GAP_PX = 10;

  // ---------- Name helpers ----------
  function normalizeName(full) {
    if (!full) return null;
    return full.replace(/\s+/g, " ").trim();
  }

  function firstNameFromFull(full) {
    const n = normalizeName(full);
    if (!n) return null;
    const cleaned = n.split("(")[0].split(",")[0].trim();
    const parts = cleaned.split(" ").filter(Boolean);
    return parts.length ? parts[0] : null;
  }

  function getProfileName() {
    const anchor = document
      .querySelector('a[aria-label] h1')
      ?.closest('a[aria-label]');
    const aria = anchor?.getAttribute("aria-label")?.trim();
    if (aria) return aria;

    const h1 = document.querySelector("main h1, h1");
    const txt = h1?.textContent?.trim();
    if (txt && txt.length >= 2 && txt.length <= 100) return txt;

    const title = document.title;
    if (title && title.includes(" | LinkedIn")) return title.split("|")[0].trim();

    return null;
  }

  function buildMessage(template, fullName) {
    const full = normalizeName(fullName) || "";
    const first = firstNameFromFull(full) || "there";

    const msg = (template || "")
      .replaceAll("{FirstName}", first)
      .replaceAll("{Name}", first)
      .replaceAll("{FullName}", full);

    return { msg, first, full };
  }

  // ---------- Clipboard ----------
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback copy
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  // ---------- Auto Paste (React/Ember safe) ----------
  async function pasteIntoTextarea(text) {
    let textarea = null;

    // Wait for the invite textarea to exist
    for (let i = 0; i < 20; i++) {
      textarea = document.querySelector("#custom-message");
      if (textarea) break;
      await sleep(100);
    }
    if (!textarea) return false;

    textarea.focus();

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (!nativeSetter) return false;

    nativeSetter.call(textarea, text);

    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  // ---------- Toast ----------
  function showToast(msg) {
    const toast = document.createElement("div");
    toast.textContent = msg;

    toast.style.position = "fixed";
    toast.style.left = "24px";
    toast.style.bottom = "24px";
    toast.style.zIndex = "999999";

    toast.style.background = "#ffffff";
    toast.style.border = "1px solid #e2e8f0";
    toast.style.color = "#1e293b";

    toast.style.padding = "8px 10px";
    toast.style.borderRadius = "8px";
    toast.style.fontSize = "12px";
    toast.style.fontFamily =
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 8px 24px rgba(15, 23, 42, 0.12)";

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }

  // ---------- Positioning helpers ----------
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function getActiveDialog() {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    let best = null;
    let bestArea = 0;

    for (const d of dialogs) {
      const r = d.getBoundingClientRect();
      const visible =
        r.width > 200 &&
        r.height > 150 &&
        r.bottom > 0 &&
        r.right > 0 &&
        r.top < window.innerHeight &&
        r.left < window.innerWidth;

      if (!visible) continue;

      const area = r.width * r.height;
      if (area > bestArea) {
        bestArea = area;
        best = d;
      }
    }
    return best;
  }

  function findSendButtonInDialog(dialog) {
    if (!dialog) return null;

    // Try common/robust selectors
    const candidates = [
      'button[aria-label="Send"]',
      'button.artdeco-button--primary',
      'button[data-control-name*="send"]',
      'button[type="submit"]'
    ];

    for (const sel of candidates) {
      const btns = Array.from(dialog.querySelectorAll(sel));
      // Pick the one whose text is "Send" if possible
      const exact = btns.find(
        (b) => (b.textContent || "").trim().toLowerCase() === "send"
      );
      if (exact) return exact;

      // Otherwise first visible button
      const visible = btns.find((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 40 && r.height > 20;
      });
      if (visible) return visible;
    }

    return null;
  }

  function positionButton(btn) {
  const dialog = getActiveDialog();

  if (dialog) {
    const dialogRect = dialog.getBoundingClientRect();
    const btnW = btn.offsetWidth || 140;
    const btnH = btn.offsetHeight || 36;
    

    const VERTICAL_GAP = 20;   // <-- increase space here
    const HORIZONTAL_ALIGN = "right"; // "left" | "center" | "right"

    let left;

    if (HORIZONTAL_ALIGN === "left") {
      left = dialogRect.left;
    } else if (HORIZONTAL_ALIGN === "center") {
      left = dialogRect.left + (dialogRect.width - btnW) / 2;
    } else {
      // right aligned (matches Send button alignment visually)
      left = dialogRect.right - btnW;
    }

    let top = dialogRect.bottom + VERTICAL_GAP;

    // Clamp inside viewport
    left = clamp(left, 10, window.innerWidth - btnW - 10);
    top = clamp(top, 10, window.innerHeight - btnH - 10);

    btn.style.position = "fixed";
    btn.style.left = `${Math.round(left)}px`;
    btn.style.top = `${Math.round(top)}px`;
    btn.style.transform = "none";

    return;
  }

  // Fallback position when modal not open
  btn.style.position = "fixed";
  btn.style.left = "28px";
  btn.style.top = "50%";
  btn.style.transform = "translateY(-50%)";
}

  // ---------- Button ----------
  let __posInterval = null;
  let __listenersAttached = false;

  function attachRepositionListeners() {
    if (__listenersAttached) return;
    __listenersAttached = true;

    const onMove = () => {
      const existing = document.getElementById(UI_ID);
      if (existing) positionButton(existing);
    };

    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);

    // Poll because LinkedIn SPA + modal animations
    __posInterval = setInterval(() => {
      const existing = document.getElementById(UI_ID);
      if (!existing) {
        clearInterval(__posInterval);
        __posInterval = null;
        __listenersAttached = false;
        return;
      }
      positionButton(existing);
    }, 350);
  }

  function ensureButton() {
    if (document.getElementById(UI_ID)) return;

    const btn = document.createElement("button");
    btn.id = UI_ID;
    btn.type = "button";
    btn.textContent = "Copy & Paste";
    btn.setAttribute("aria-label", "Copy and paste personalized message");

    // Style (same vibe as before)
    btn.style.zIndex = "999999";
    btn.style.background = "#6366f1";
    btn.style.color = "#ffffff";
    btn.style.border = "none";
    btn.style.borderRadius = "8px";
    btn.style.padding = "10px 14px";
    btn.style.fontSize = "12px";
    btn.style.fontFamily =
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
    btn.style.fontWeight = "700";
    btn.style.letterSpacing = "0.01em";
    btn.style.cursor = "pointer";
    btn.style.boxShadow = "0 12px 28px rgba(15,23,42,.25)";
    btn.style.transition = "transform 0.12s ease, background 0.12s ease, opacity 0.12s ease";

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "#4f46e5";
      // Small nudge (but do not mess with anchored positioning too much)
      btn.style.transform = "translateX(2px)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.background = "#6366f1";
      btn.style.transform = "none";
      // Re-apply exact position to avoid drift
      positionButton(btn);
    });

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.style.opacity = "0.85";
      const oldText = btn.textContent;
      btn.textContent = "Working...";

      try {
        const { template, enabled } = await chrome.storage.sync.get({
          template: "",
          enabled: true
        });

        if (!enabled) {
          showToast("Extension disabled");
          return;
        }

        if (!template || !template.trim()) {
          showToast("Set a template in the popup");
          return;
        }

        // LinkedIn SPA can load name late
        let fullName = getProfileName();
        for (let i = 0; i < 12 && !fullName; i++) {
          await sleep(200);
          fullName = getProfileName();
        }

        if (!fullName) {
          showToast("Profile name not found");
          return;
        }

        const { msg, first, full } = buildMessage(template, fullName);

        const copied = await copyToClipboard(msg);
        const pasted = await pasteIntoTextarea(msg);

        await chrome.storage.sync.set({
          latest_full_name: full,
          latest_first_name: first,
          latest_message: msg,
          latest_updated_at: new Date().toISOString()
        });

        if (pasted) showToast(`Pasted for ${first}`);
        else if (copied) showToast(`Copied for ${first}`);
        else showToast("Copy failed");
      } finally {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.textContent = oldText;
        positionButton(btn);
      }
    });

    document.body.appendChild(btn);
    positionButton(btn);
    attachRepositionListeners();
  }

  // ---------- SPA navigation handling ----------
  let lastUrl = location.href;

  function tick() {
    // Ensure button is always there
    ensureButton();

    // Reposition frequently (handles modal open/close without URL change)
    const btn = document.getElementById(UI_ID);
    if (btn) positionButton(btn);

    // Detect URL changes
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // no-op: ensureButton + position already handled
    }
  }

  // Initial
  tick();

  // Main loop
  setInterval(tick, 600);
})();