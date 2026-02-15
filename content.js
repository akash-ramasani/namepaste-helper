(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Name helpers ----------
  function normalizeName(full) {
    if (!full) return null;
    return full.replace(/\s+/g, " ").trim();
  }

  function firstNameFromFull(full) {
    const n = normalizeName(full);
    if (!n) return null;

    // Remove extra fragments if present
    const cleaned = n.split("(")[0].split(",")[0].trim();
    const parts = cleaned.split(" ").filter(Boolean);

    // Handles single-name profiles: "Madonna" -> first name = "Madonna"
    return parts.length ? parts[0] : null;
  }

  function getProfileName() {
    // BEST match for your provided DOM:
    // <a aria-label="Full Name"><h1>Full Name</h1></a>
    const anchor = document
      .querySelector('a[aria-label] h1')
      ?.closest('a[aria-label]');
    const aria = anchor?.getAttribute("aria-label")?.trim();
    if (aria) return aria;

    // Fallback: profile header h1
    const h1 = document.querySelector("main h1, h1");
    const txt = h1?.textContent?.trim();
    if (txt && txt.length >= 2 && txt.length <= 100) return txt;

    // Fallback: title
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
      } catch (e2) {
        return false;
      }
    }
  }

  // ---------- Toast (matches your design language) ----------
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
    toast.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 8px 24px rgba(15, 23, 42, 0.12)";

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }

  // ---------- Floating button ----------
  const UI_ID = "__li_name_paste_helper_btn__";

  function ensureButton() {
    if (document.getElementById(UI_ID)) return;

    const btn = document.createElement("button");
    btn.id = UI_ID;
    btn.type = "button";
    btn.textContent = "Copy Message";
    btn.setAttribute("aria-label", "Copy personalized message");

    // POSITION (as per your diagram):
    // left side, vertically centered, with some inset into the page
    btn.style.position = "fixed";
    btn.style.left = "28px";          // inset from extreme edge (adjust if you want)
    btn.style.top = "50%";
    btn.style.transform = "translateY(-50%)";
    btn.style.zIndex = "999999";

    // STYLE to match your popup buttons
    btn.style.background = "#6366f1";
    btn.style.color = "#ffffff";
    btn.style.border = "none";
    btn.style.borderRadius = "6px";
    btn.style.padding = "10px 14px";

    btn.style.fontSize = "12px";
    btn.style.fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
    btn.style.fontWeight = "700";
    btn.style.letterSpacing = "0.01em";

    btn.style.cursor = "pointer";
    btn.style.boxShadow = "0 8px 24px rgba(15, 23, 42, 0.18)";
    btn.style.transition = "transform 0.12s ease, background 0.12s ease, opacity 0.12s ease";

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "#4f46e5";
      btn.style.transform = "translateY(-50%) translateX(2px)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.background = "#6366f1";
      btn.style.transform = "translateY(-50%) translateX(0)";
    });

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.style.opacity = "0.85";
      const oldText = btn.textContent;
      btn.textContent = "Copying...";

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
        const ok = await copyToClipboard(msg);

        await chrome.storage.sync.set({
          latest_full_name: full,
          latest_first_name: first,
          latest_message: msg,
          latest_updated_at: new Date().toISOString()
        });

        showToast(ok ? `Copied for ${first}` : "Copy failed");
      } finally {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.textContent = oldText;
      }
    });

    document.body.appendChild(btn);
  }

  async function generatePreviewSilently() {
    const { template, enabled } = await chrome.storage.sync.get({
      template: "",
      enabled: true
    });

    if (!enabled) return;

    // best-effort preview even before clicking copy
    for (let i = 0; i < 15; i++) {
      const fullName = getProfileName();
      if (fullName) {
        const { msg, first, full } = buildMessage(template, fullName);
        await chrome.storage.sync.set({
          latest_full_name: full,
          latest_first_name: first,
          latest_message: msg,
          latest_updated_at: new Date().toISOString()
        });
        return;
      }
      await sleep(250);
    }
  }

  // Initial run
  ensureButton();
  generatePreviewSilently();

  // Handle LinkedIn SPA navigation (URL changes in same tab)
  let lastUrl = location.href;
  setInterval(() => {
    const cur = location.href;
    if (cur !== lastUrl) {
      lastUrl = cur;

      if (cur.includes("linkedin.com/in/")) {
        ensureButton();
        generatePreviewSilently();
      } else {
        // remove button outside profiles (optional)
        const existing = document.getElementById(UI_ID);
        if (existing) existing.remove();
      }
    }
  }, 800);
})();
