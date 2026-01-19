const tauri = window.__TAURI__ || {};
const invoke =
  (tauri.core && tauri.core.invoke) ||
  tauri.invoke ||
  (tauri.tauri && tauri.tauri.invoke) ||
  null;
const dialog =
  (tauri.dialog && tauri.dialog.open ? tauri.dialog : null) ||
  (tauri.plugins && tauri.plugins.dialog ? tauri.plugins.dialog : null) ||
  null;

const resourcesInput = document.getElementById("resources-path");
const devtoolsToggle = document.getElementById("devtools-toggle");
const uninstallBtn = document.getElementById("unpatch-btn");
const patchBtn = document.getElementById("patch-btn");
const titlebarStatus = document.getElementById("titlebar-status");
const titlebarStatusText = document.getElementById("titlebar-status-text");
const statusDot = document.querySelector(".status-dot");
const logEl = document.getElementById("log");
const SETTINGS_KEY = "ghostguessr_patcher_settings";

const loadUiSettings = () => {
  if (!devtoolsToggle) return;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed.enableDevtools === "boolean") {
      devtoolsToggle.checked = parsed.enableDevtools;
    }
  } catch {}
};

const saveUiSettings = () => {
  if (!devtoolsToggle) return;
  try {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ enableDevtools: devtoolsToggle.checked }),
    );
  } catch {}
};

const log = (message, level = "info") => {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = `log-entry ${level}`;
  entry.innerHTML = `<span class="tag">${level.toUpperCase()}</span><span>[${time}] ${message}</span>`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
};

const setBusy = (isBusy) => {
  document.getElementById("patch-btn").disabled = isBusy;
  document.getElementById("unpatch-btn").disabled = isBusy;
  document.getElementById("detect-btn").disabled = isBusy;
  document.getElementById("browse-btn").disabled = isBusy;
  document.body.classList.toggle("is-busy", isBusy);
};

const setStatus = (text, tone) => {
  if (titlebarStatusText) {
    titlebarStatusText.textContent = text || "";
  }
  if (titlebarStatus) {
    const danger = tone === "danger";
    const success = tone === "success";
    titlebarStatus.classList.toggle("success", success);
    titlebarStatus.classList.toggle("danger", danger);
  }
};

const getPayload = () => ({
  resourcesPath: resourcesInput.value.trim() || null,
  enableDevtools: devtoolsToggle ? devtoolsToggle.checked : false,
});

const autoDetect = async () => {
  if (!invoke) {
    log("Tauri invoke not available.", "error");
    return;
  }
  setStatus("Detecting...", "info");
  try {
    const path = await invoke("detect_resources_path");
    if (path) {
      resourcesInput.value = path;
      log(`Detected resources path: ${path}`, "success");
      await refreshStatus();
    } else {
      log("Could not auto-detect resources path.", "warn");
      setStatus("Needs Path", "danger");
    }
  } catch (error) {
    log(`Detect failed: ${error}`, "error");
    setStatus("Error", "danger");
  }
};

const refreshStatus = async () => {
  if (!invoke) return;
  try {
    const status = await invoke("get_status", getPayload());
    if (status.resources_path && !resourcesInput.value) {
      resourcesInput.value = status.resources_path;
    }
    if (status.patched) {
      setStatus("Patched", "success");
      log("Already patched. You can uninstall to restore.", "warn");
      uninstallBtn.classList.remove("hidden");
      patchBtn.classList.add("hidden");
    } else {
      setStatus("Ready", "info");
      uninstallBtn.classList.add("hidden");
      patchBtn.classList.remove("hidden");
    }
  } catch (error) {
    log(`Status check failed: ${error}`, "error");
    setStatus("Ready", "info");
  }
};

const patch = async () => {
  if (!invoke) {
    log("Tauri invoke not available.", "error");
    return;
  }
  const payload = getPayload();
  setStatus("Patching...", "info");
  log("Starting patch...", "info");
  setBusy(true);
  try {
    const result = await invoke("patch", payload);
    log(result || "Patch completed.", "success");
    await refreshStatus();
  } catch (error) {
    log(`Patch failed: ${error}`, "error");
    setStatus("Error", "danger");
  } finally {
    setBusy(false);
  }
};

const unpatch = async () => {
  if (!invoke) {
    log("Tauri invoke not available.", "error");
    return;
  }
  const payload = getPayload();
  setStatus("Restoring...", "info");
  log("Starting uninstall...", "info");
  setBusy(true);
  try {
    const result = await invoke("unpatch", payload);
    log(result || "Uninstall completed.", "success");
    await refreshStatus();
  } catch (error) {
    log(`Uninstall failed: ${error}`, "error");
    setStatus("Error", "danger");
  } finally {
    setBusy(false);
  }
};

const browseDir = async () => {
  try {
    const selected = await invoke("browse_resources_path");
    if (selected) {
      resourcesInput.value = selected;
      log(`Selected resources path: ${selected}`, "success");
      await refreshStatus();
    }
  } catch (error) {
    log(`Dialog failed: ${error}`, "error");
  }
};

const clearLog = () => {
  logEl.innerHTML = "";
};

document.getElementById("detect-btn").addEventListener("click", autoDetect);
document.getElementById("patch-btn").addEventListener("click", patch);
document.getElementById("unpatch-btn").addEventListener("click", unpatch);
document.getElementById("browse-btn").addEventListener("click", browseDir);
document.getElementById("clear-log-btn").addEventListener("click", clearLog);
if (devtoolsToggle) {
  devtoolsToggle.addEventListener("change", saveUiSettings);
}
loadUiSettings();

if (!invoke) {
  setStatus("Tauri runtime missing", "danger");
  log(
    "Tauri invoke not available. Run via `cargo tauri dev` or the built EXE.",
    "error",
  );
  document.getElementById("patch-btn").disabled = true;
  document.getElementById("unpatch-btn").disabled = true;
  document.getElementById("detect-btn").disabled = true;
  document.getElementById("browse-btn").disabled = true;
} else {
  autoDetect();
}

document.querySelectorAll(".tab-btn").forEach((button) => {
  button.addEventListener("click", () => {
    if (!button.dataset.tab) {
      return;
    }
    document
      .querySelectorAll(".tab-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((pane) => pane.classList.remove("active"));
    button.classList.add("active");
    const target = button.getAttribute("data-tab");
    const pane = document.querySelector(`[data-tab-content=\"${target}\"]`);
    if (pane) {
      pane.classList.add("active");
    }
  });
});

document
  .getElementById("github-link")
  .addEventListener("click", async (event) => {
    event.preventDefault();
    const url = "https://github.com/JojocraftTv/GhostGuessr";
    if (tauri && tauri.core && tauri.core.invoke) {
      try {
        await tauri.core.invoke("open_url", { url });
        return;
      } catch {}
    }
    window.open(url, "_blank");
  });

const windowApi = tauri.window || null;
const getWindow = () => {
  if (!windowApi) return null;
  if (windowApi.appWindow) return windowApi.appWindow;
  if (windowApi.getCurrentWindow) return windowApi.getCurrentWindow();
  if (windowApi.getCurrent) return windowApi.getCurrent();
  return null;
};

document.getElementById("minimize-btn").addEventListener("click", async () => {
  let invokeError = null;
  if (invoke) {
    try {
      await invoke("minimize_window");
      return;
    } catch (err) {
      invokeError = err;
    }
  }
  const win = getWindow();
  if (win && win.minimize) {
    try {
      await win.minimize();
      return;
    } catch {}
  }
  log(
    invokeError ? `Minimize failed: ${invokeError}` : "Minimize not available.",
    "error",
  );
});

document.getElementById("close-btn").addEventListener("click", async () => {
  let invokeError = null;
  if (invoke) {
    try {
      await invoke("close_window");
      return;
    } catch (err) {
      invokeError = err;
    }
  }
  const win = getWindow();
  if (win && win.close) {
    try {
      await win.close();
      return;
    } catch {}
  }
  log(
    invokeError ? `Close failed: ${invokeError}` : "Close not available.",
    "error",
  );
});

window.addEventListener("keydown", (event) => {
  if (
    event.key === "F12" ||
    (event.ctrlKey && event.shiftKey && ["I", "J", "C"].includes(event.key))
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});
