let deferredInstallPrompt = null;
const SW_VERSION = "13";

function drawDefaultIcon(ctx, size) {
  const accent = Store.state.settings.accentColor || "#2563eb";
  const radius = size * 0.19;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(size, 0, size, size, radius);
  ctx.arcTo(size, size, 0, size, radius);
  ctx.arcTo(0, size, 0, 0, radius);
  ctx.arcTo(0, 0, size, 0, radius);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${size * 0.58}px Segoe UI, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("₮", size / 2, size * 0.56);
}

function renderIconCanvas(size, customImage) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (customImage) {
    const scale = Math.max(size / customImage.width, size / customImage.height);
    const w = customImage.width * scale;
    const h = customImage.height * scale;
    ctx.drawImage(customImage, (size - w) / 2, (size - h) / 2, w, h);
  } else {
    drawDefaultIcon(ctx, size);
  }
  return canvas.toDataURL("image/png");
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function regenerateManifest() {
  const stored = Store.state.appearance.appIcon;
  const customImage = stored ? await loadImage(stored).catch(() => null) : null;
  const icon192 = renderIconCanvas(192, customImage);
  const icon512 = renderIconCanvas(512, customImage);

  const name = Store.state.settings.userName.trim();
  const manifest = {
    name: name ? `${name}'s Money Tracker` : "My Money Tracker",
    short_name: "MoneyTracker",
    description: "Personal finance tracker for loans, savings goals, expenses, remittances, and retirement planning.",
    start_url: "./index.html",
    scope: "./",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f4f6fb",
    theme_color: Store.state.settings.accentColor || "#2563eb",
    icons: [
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.querySelector('link[rel="manifest"]');
  if (link) {
    if (link.dataset.blobUrl) URL.revokeObjectURL(link.dataset.blobUrl);
    link.href = url;
    link.dataset.blobUrl = url;
  }

  const appleTouch = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleTouch) appleTouch.href = icon192;
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) favicon.href = icon192;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = manifest.theme_color;

  const preview = document.getElementById("appIconPreview");
  if (preview) preview.src = icon192;
}

function handleAppIconUpload(file) {
  const reader = new FileReader();
  reader.onload = () => {
    Store.setAppIcon(reader.result);
    regenerateManifest();
    showToast("App icon updated");
  };
  reader.readAsDataURL(file);
}

function resetAppIcon() {
  Store.setAppIcon(null);
  regenerateManifest();
  showToast("Reset to default icon");
}

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function initInstallPrompt() {
  if (isStandaloneDisplay()) return;

  const installBtn = document.getElementById("installAppBtn");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBtn) installBtn.hidden = false;
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installBtn.hidden = true;
    });
  }

  window.addEventListener("appinstalled", () => {
    if (installBtn) installBtn.hidden = true;
  });
}

function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(`sw.js?v=${SW_VERSION}`).then((reg) => {
    reg.update().catch(() => {});
    if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          newWorker.postMessage("SKIP_WAITING");
        }
      });
    });
  }).catch(() => {});

  let hasReloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasReloaded) return;
    hasReloaded = true;
    location.reload();
  });
}

function initPWA() {
  regenerateManifest();
  initInstallPrompt();
  initServiceWorker();

  document.getElementById("appIconUpload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleAppIconUpload(file);
    e.target.value = "";
  });
  document.getElementById("resetAppIconBtn").addEventListener("click", resetAppIcon);
}
