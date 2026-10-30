const tauri = window.__TAURI__ || {};
const invoke =
  (tauri.core && tauri.core.invoke) ||
  tauri.invoke ||
  (tauri.tauri && tauri.tauri.invoke) ||
  null;
const listen = (tauri.event && tauri.event.listen) || null;

const resourcesInput = document.getElementById("resources-path");
const devtoolsToggle = document.getElementById("devtools-toggle");
const channelSelect = document.getElementById("channel-select");
const localUrlInput = document.getElementById("local-url");
const channelHint = document.getElementById("channel-hint");
const uninstallBtn = document.getElementById("unpatch-btn");
const patchBtn = document.getElementById("patch-btn");
const titlebarStatus = document.getElementById("titlebar-status");
const titlebarStatusText = document.getElementById("titlebar-status-text");
const logEl = document.getElementById("log");
const SETTINGS_KEY = "ghostguessr_patcher_settings";
const DEFAULT_LOCAL_URL = "http://localhost:8080/ghostguessr-core.user.js";

const CHANNEL_HINTS = {
  stable: "The game downloads the newest full release on every start.",
  beta: "The game downloads the newest beta (built from every commit) on every start.",
  local: "The game loads the script from your local server (pnpm serve) on every page load.",
};

/* ---------- settings ---------- */

let hasSavedChannel = true;

const loadUiSettings = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}");
    if (typeof parsed.enableDevtools === "boolean") devtoolsToggle.checked = parsed.enableDevtools;
    const channel = parsed.channel === "dev" ? "beta" : parsed.channel; // older patchers called it "dev"
    if (["stable", "beta", "local"].includes(channel)) channelSelect.value = channel;
    else hasSavedChannel = false;
    localUrlInput.value = parsed.localUrl || DEFAULT_LOCAL_URL;
    if (parsed.resourcesPath) resourcesInput.value = parsed.resourcesPath;
  } catch {
    localUrlInput.value = DEFAULT_LOCAL_URL;
  }
  updateChannelUi();
};

const saveUiSettings = () => {
  try {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        enableDevtools: devtoolsToggle.checked,
        channel: channelSelect.value,
        localUrl: localUrlInput.value.trim() || DEFAULT_LOCAL_URL,
        resourcesPath: resourcesInput.value.trim(),
      }),
    );
  } catch {}
};

const updateChannelUi = () => {
  localUrlInput.classList.toggle("hidden", channelSelect.value !== "local");
  channelHint.textContent = CHANNEL_HINTS[channelSelect.value] || "";
};

/* ---------- log / status ---------- */

const log = (message, level = "info") => {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = `log-entry ${level}`;
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = level.toUpperCase();
  const text = document.createElement("span");
  text.textContent = `[${time}] ${message}`;
  entry.append(tag, text);
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
};

const setBusy = (isBusy) => {
  for (const id of ["patch-btn", "unpatch-btn", "detect-btn", "browse-btn"]) {
    document.getElementById(id).disabled = isBusy;
  }
  document.body.classList.toggle("is-busy", isBusy);
};

const setStatus = (text, tone) => {
  if (titlebarStatusText) titlebarStatusText.textContent = text || "";
  if (titlebarStatus) {
    titlebarStatus.classList.toggle("success", tone === "success");
    titlebarStatus.classList.toggle("danger", tone === "danger");
  }
};

const gamePath = () => resourcesInput.value.trim() || null;

const getOptions = () => ({
  devtools: devtoolsToggle.checked,
  autoUpdate: true,
  channel: channelSelect.value,
  localUrl: channelSelect.value === "local" ? localUrlInput.value.trim() || DEFAULT_LOCAL_URL : null,
});

/* ---------- actions ---------- */

const autoDetect = async () => {
  if (!invoke) return log("Tauri invoke not available.", "error");
  setStatus("Detecting...", "info");
  try {
    const path = await invoke("detect_game");
    if (path) {
      resourcesInput.value = path;
      saveUiSettings();
      log(`Detected game folder: ${path}`, "success");
      await refreshStatus();
    } else {
      log("Could not auto-detect the game folder. Use Settings → Browse.", "warn");
      setStatus("Needs Path", "danger");
    }
  } catch (error) {
    log(`Detect failed: ${error}`, "error");
    setStatus("Error", "danger");
  }
};

const refreshStatus = async ({ quiet = false } = {}) => {
  if (!invoke) return;
  try {
    const status = await invoke("get_status", { path: gamePath() });
    if (status.gamePath && !resourcesInput.value) resourcesInput.value = status.gamePath;
    const state = status.state.kind;
    if (state === "patched") {
      setStatus("Patched", "success");
      if (!quiet) {
        log(
          `Patched (script ${status.state.scriptVersion}, source: ${status.state.channel}${status.state.devtools ? ", DevTools on" : ""}).`,
          "success",
        );
      }
      patchBtn.textContent = "Repatch";
      uninstallBtn.classList.remove("hidden");
    } else if (state === "legacy") {
      setStatus("Old Patch", "danger");
      if (!quiet) log("Old GhostGuessr patch found. Press Patch to upgrade.", "warn");
      patchBtn.textContent = "Patch";
      uninstallBtn.classList.toggle("hidden", !status.backupExists);
    } else {
      setStatus("Ready", "info");
      patchBtn.textContent = "Patch";
      uninstallBtn.classList.add("hidden");
    }
    patchBtn.classList.remove("hidden");
  } catch (error) {
    log(`Status check failed: ${error}`, "error");
    setStatus("Needs Path", "danger");
  }
};

const patch = async () => {
  if (!invoke) return log("Tauri invoke not available.", "error");
  saveUiSettings();
  setStatus("Patching...", "info");
  log("Starting patch...", "info");
  setBusy(true);
  try {
    const result = await invoke("install", { path: gamePath(), options: getOptions() });
    log(result || "Patch completed.", "success");
    await refreshStatus({ quiet: true });
  } catch (error) {
    log(`Patch failed: ${error}`, "error");
    setStatus("Error", "danger");
  } finally {
    setBusy(false);
  }
};

const unpatch = async () => {
  if (!invoke) return log("Tauri invoke not available.", "error");
  setStatus("Restoring...", "info");
  log("Starting uninstall...", "info");
  setBusy(true);
  try {
    const result = await invoke("uninstall", { path: gamePath() });
    log(result || "Uninstall completed.", "success");
    await refreshStatus({ quiet: true });
  } catch (error) {
    log(`Uninstall failed: ${error}`, "error");
    setStatus("Error", "danger");
  } finally {
    setBusy(false);
  }
};

const browseDir = async () => {
  try {
    const selected = await invoke("browse_game");
    if (selected) {
      resourcesInput.value = selected;
      saveUiSettings();
      log(`Selected game folder: ${selected}`, "success");
      await refreshStatus();
    }
  } catch (error) {
    log(`Dialog failed: ${error}`, "error");
  }
};

document.getElementById("detect-btn").addEventListener("click", autoDetect);
patchBtn.addEventListener("click", patch);
uninstallBtn.addEventListener("click", unpatch);
document.getElementById("browse-btn").addEventListener("click", browseDir);
document.getElementById("clear-log-btn").addEventListener("click", () => (logEl.innerHTML = ""));
devtoolsToggle.addEventListener("change", saveUiSettings);
channelSelect.addEventListener("change", () => {
  updateChannelUi();
  saveUiSettings();
  log(`Script source: ${channelSelect.options[channelSelect.selectedIndex].text}. Press Patch/Repatch to apply.`, "info");
});
localUrlInput.addEventListener("change", saveUiSettings);
resourcesInput.addEventListener("change", () => {
  saveUiSettings();
  refreshStatus();
});

/* ---------- update check ---------- */

const checkUpdate = async () => {
  if (!invoke) return;
  try {
    const info = await invoke("check_update");
    if (!info.available) return;
    const notifyEl = document.getElementById("update-notification");
    if (!notifyEl) return;
    notifyEl.textContent = "New version found: ";
    const strong = document.createElement("strong");
    strong.textContent = info.latest;
    notifyEl.appendChild(strong);
    notifyEl.classList.remove("hidden");
    notifyEl.title = "Click to download";
    notifyEl.addEventListener("click", () => invoke("open_url", { url: info.url || "https://github.com/JojocraftTv/GhostGuessr/releases" }));
  } catch (err) {
    console.error(`Update check failed: ${err}`);
  }
};

/* ---------- boot ---------- */

loadUiSettings();

if (!invoke) {
  setStatus("Tauri runtime missing", "danger");
  log("Tauri invoke not available. Run via `cargo tauri dev` or the built EXE.", "error");
  for (const id of ["patch-btn", "unpatch-btn", "detect-btn", "browse-btn"]) document.getElementById(id).disabled = true;
} else {
  if (listen) listen("patcher-log", (event) => log(event.payload.message, event.payload.level));
  // A beta patcher defaults to the beta script until the user picks a source.
  if (!hasSavedChannel) {
    invoke("patcher_channel")
      .then((channel) => {
        if (channel === "beta") {
          channelSelect.value = "beta";
          updateChannelUi();
        }
      })
      .catch(() => {});
  }
  (resourcesInput.value ? refreshStatus() : autoDetect()).then(checkUpdate);
}

document.querySelectorAll(".tab-btn").forEach((button) => {
  button.addEventListener("click", () => {
    if (!button.dataset.tab) return;
    document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((pane) => pane.classList.remove("active"));
    button.classList.add("active");
    const pane = document.querySelector(`[data-tab-content="${button.getAttribute("data-tab")}"]`);
    if (pane) pane.classList.add("active");
  });
});

document.getElementById("github-link").addEventListener("click", async (event) => {
  event.preventDefault();
  try {
    await invoke("open_url", { url: "https://github.com/JojocraftTv/GhostGuessr" });
  } catch {
    window.open("https://github.com/JojocraftTv/GhostGuessr", "_blank");
  }
});

document.getElementById("minimize-btn").addEventListener("click", () => invoke && invoke("minimize_window").catch((e) => log(`Minimize failed: ${e}`, "error")));
document.getElementById("close-btn").addEventListener("click", () => invoke && invoke("close_window").catch((e) => log(`Close failed: ${e}`, "error")));

window.addEventListener("keydown", (event) => {
  if (event.key === "F12" || (event.ctrlKey && event.shiftKey && ["I", "J", "C"].includes(event.key.toUpperCase()))) {
    event.preventDefault();
    event.stopPropagation();
  }
});
