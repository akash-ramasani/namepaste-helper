const tplEl = document.getElementById("tpl");
const enabledEl = document.getElementById("enabled");
const saveBtn = document.getElementById("save");
const exampleBtn = document.getElementById("example");
const previewEl = document.getElementById("preview");
const statusPill = document.getElementById("statusPill");
const copyBtn = document.getElementById("copyFromPopup");
const refreshBtn = document.getElementById("refresh");

let isEditingTemplate = false;

function setStatus(text) {
  statusPill.textContent = text;
}

function getStorage(defaults) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(defaults, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ ...defaults });
        return;
      }
      resolve({ ...defaults, ...(res || {}) });
    });
  });
}

function loadSettingsOnce() {
  chrome.storage.sync.get(
    {
      template: "",
      enabled: true
    },
    (res) => {
      enabledEl.checked = !!res.enabled;

      if (!isEditingTemplate) {
        tplEl.value = res.template || "";
      }

      setStatus(res.enabled ? "Ready" : "Disabled");
    }
  );
}

function loadPreviewOnly() {
  chrome.storage.sync.get(
    {
      latest_full_name: "",
      latest_message: "",
      enabled: true
    },
    (res) => {
      if (!res.enabled) {
        setStatus("Disabled");
      } else if (res.latest_full_name) {
        setStatus("Ready");
      } else {
        setStatus("Waiting");
      }

      previewEl.value = res.latest_message || "";
    }
  );
}

function saveTemplate() {
  const enabled = !!enabledEl.checked;
  const template = (tplEl.value || "").trim();

  chrome.storage.sync.set({ enabled, template }, () => {
    setStatus("Saved");
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
  } catch {
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
      return !!ok;
    } catch {
      return false;
    }
  }
}

async function getActiveLinkedInTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab || !tab.id) return null;
  if (!tab.url || !/^https:\/\/www\.linkedin\.com\/in\//i.test(tab.url)) return null;

  return tab;
}

tplEl.addEventListener("input", () => {
  isEditingTemplate = true;
});

tplEl.addEventListener("blur", () => {
  isEditingTemplate = false;
});

saveBtn.addEventListener("click", saveTemplate);

enabledEl.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: !!enabledEl.checked }, () => {
    setStatus(enabledEl.checked ? "Ready" : "Disabled");
  });
});

exampleBtn.addEventListener("click", () => {
  tplEl.value =
    "Hi {FirstName} - I’m Akash, founder of Job Watch.\n\n" +
    "We help students land interviews by automating their job search (AI + human ops). Early users are already seeing meaningfully higher response rates vs standard applications (~5–10%).";
  isEditingTemplate = true;
});

refreshBtn.addEventListener("click", loadPreviewOnly);

copyBtn.addEventListener("click", async () => {
  try {
    setStatus("Working");

    const { enabled, latest_message } = await getStorage({
      enabled: true,
      latest_message: ""
    });

    if (!enabled) {
      setStatus("Disabled");
      return;
    }

    if (!latest_message) {
      setStatus("No message");
      return;
    }

    await copyText(latest_message);

    const tab = await getActiveLinkedInTab();
    if (!tab) {
      setStatus("Open profile");
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      {
        type: "NAMEPASTE_AUTOFILL",
        message: latest_message
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("[NamePaste Helper]", chrome.runtime.lastError.message);
          setStatus("Refresh page");
          return;
        }

        if (response?.ok) {
          setStatus("Pasted");
        } else if (response?.reason === "refresh_required") {
          setStatus("Refresh page");
        } else {
          setStatus("Paste failed");
        }

        setTimeout(loadPreviewOnly, 400);
      }
    );
  } catch (e) {
    console.error("[NamePaste Helper]", e);
    setStatus("Error");
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadPreviewOnly();
});

window.addEventListener("focus", loadPreviewOnly);

loadSettingsOnce();
loadPreviewOnly();