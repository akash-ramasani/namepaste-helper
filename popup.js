const tplEl = document.getElementById("tpl");
const enabledEl = document.getElementById("enabled");
const saveBtn = document.getElementById("save");
const exampleBtn = document.getElementById("example");
const previewEl = document.getElementById("preview");
const statusPill = document.getElementById("statusPill");
const copyBtn = document.getElementById("copyFromPopup");
const refreshBtn = document.getElementById("refresh");

// Track whether user is actively editing the template.
// We will NEVER overwrite tplEl.value while they are typing.
let isEditingTemplate = false;

function setStatus(text) {
  statusPill.textContent = text;
}

// Load settings ONCE when popup opens (template + enabled)
function loadSettingsOnce() {
  chrome.storage.sync.get(
    {
      // IMPORTANT: template default is EMPTY so placeholder shows
      template: "",
      enabled: true
    },
    (res) => {
      enabledEl.checked = !!res.enabled;

      // Only set value if user isn't typing (and on first load they won't be)
      if (!isEditingTemplate) {
        tplEl.value = res.template || "";
      }

      setStatus(res.enabled ? "Ready" : "Disabled");
    }
  );
}

// Load ONLY preview data (can be called repeatedly)
function loadPreviewOnly() {
  chrome.storage.sync.get(
    {
      latest_full_name: "",
      latest_message: "",
      enabled: true
    },
    (res) => {
      // Update status
      if (!res.enabled) {
        setStatus("Disabled");
      } else if (res.latest_full_name) {
        setStatus(`Ready`);
      } else {
        setStatus("Waiting");
      }

      // Update preview textbox
      previewEl.value = res.latest_message || "";
    }
  );
}

function saveTemplate() {
  const enabled = !!enabledEl.checked;
  const template = (tplEl.value || "").trim();

  chrome.storage.sync.set({ enabled, template }, () => {
    setStatus("Saved");
    // Refresh preview after save (content script will use new template on next generate/copy)
    setTimeout(() => {
      loadPreviewOnly();
      setStatus(enabled ? "Ready" : "Disabled");
    }, 150);
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
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

// --- Event handlers ---

tplEl.addEventListener("input", () => {
  isEditingTemplate = true;
});

// When they leave the textarea, we can allow future loads (optional)
tplEl.addEventListener("blur", () => {
  // keep true if you want to never overwrite; set false if you want re-sync after blur
  isEditingTemplate = false;
});

saveBtn.addEventListener("click", saveTemplate);

enabledEl.addEventListener("change", () => {
  // Save enabled state immediately, keep template as-is
  chrome.storage.sync.set({ enabled: !!enabledEl.checked }, () => {
    setStatus(enabledEl.checked ? "Ready" : "Disabled");
  });
});

exampleBtn.addEventListener("click", () => {
  tplEl.value =
    "Hi {FirstName},\n\n" +
    "I came across your profile and wanted to connect. If you're open to it, I’d love to share a quick note.\n\n" +
    "Thanks!";
  isEditingTemplate = true;
});

refreshBtn.addEventListener("click", loadPreviewOnly);

copyBtn.addEventListener("click", async () => {
  const { latest_message } = await chrome.storage.sync.get({ latest_message: "" });
  if (!latest_message) {
    setStatus("No message");
    return;
  }
  const ok = await copyText(latest_message);
  setStatus(ok ? "Copied" : "Copy failed");
});

// --- Init ---
loadSettingsOnce();
loadPreviewOnly();

// Only refresh preview periodically (NOT the template)
setInterval(loadPreviewOnly, 800);
