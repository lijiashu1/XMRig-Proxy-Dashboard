/**
 * ui.js – UI utilities and rendering functions.
 *
 * Provides:
 *  - Toast notifications
 *  - Skeleton loading placeholders
 *  - Formatting utilities (hashrate, bytes, uptime, numbers)
 *  - Status classification helpers
 */

// Toast notification system
let toastContainer = null;
let toastContainerPromise = null;

function ensureToastContainer() {
  if (toastContainer) return Promise.resolve(toastContainer);
  if (!toastContainerPromise) {
    toastContainerPromise = new Promise((resolve) => {
      const container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
      toastContainer = container;
      resolve(container);
    });
  }
  return toastContainerPromise;
}

export async function showToast(message, type = "info", durationMs = 3000) {
  await ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, durationMs);
}

function createSkeletonCard(lines = 3) {
  const card = document.createElement("div");
  card.className = "card skeleton";
  for (let i = 0; i < lines; i++) {
    const line = document.createElement("div");
    line.className = "skeleton-line";
    card.appendChild(line);
  }
  return card;
}

export function renderSkeleton(container, count = 6) {
  container.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "grid";
  for (let i = 0; i < count; i++) {
    grid.appendChild(createSkeletonCard(i < 4 ? 2 : 4));
  }
  container.appendChild(grid);
}

export function formatHashrate(kh) {
  if (!kh || kh === 0) return "0 H/s";
  if (kh >= 1000) return `${(kh / 1000).toFixed(2)} MH/s`;
  return `${kh.toFixed(2)} KH/s`;
}

export function formatBytes(bytes) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

export function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

/**
 * Format number with thousand separators.
 *
 * API responses can legitimately omit counters while a proxy is starting.
 * The old implementation called toString() directly and could break the
 * whole dashboard render path on a missing/null field.
 */
export function formatNumber(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) {
    return "0";
  }
  return Number(num).toLocaleString("en-US");
}

export function getStatusInfo(miners) {
  if (!miners || miners.now === 0) {
    return { cls: "status-offline", text: "离线" };
  }
  if (miners.now < miners.max * 0.5) {
    return { cls: "status-warning", text: "预警" };
  }
  return { cls: "status-online", text: "在线" };
}
