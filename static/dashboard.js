(function () {
  const cfg = window.KIFFA_CONFIG || {};
  const pinScreen = document.getElementById("pin-screen");
  const pinInput = document.getElementById("pin-input");
  const pinBtn = document.getElementById("pin-btn");
  const pinError = document.getElementById("pin-error");
  const dashMain = document.getElementById("dash-main");
  const ratingsPanel = document.getElementById("ratings-panel");
  const ratingsList = document.getElementById("ratings-list");
  const ratingsEmpty = document.getElementById("ratings-empty");
  const ratingsCount = document.getElementById("ratings-count");
  const avgRating = document.getElementById("avg-rating");
  const grid = document.getElementById("orders-grid");
  const emptyState = document.getElementById("empty-state");
  const pendingCount = document.getElementById("pending-count");
  const confirmOverlay = document.getElementById("confirm-overlay");
  const confirmInvoiceNum = document.getElementById("confirm-invoice-num");
  const cancelConfirmBtn = document.getElementById("cancel-confirm");
  const doConfirmBtn = document.getElementById("do-confirm");

  const PIN_KEY = "kiffa_dash_pin";
  let pin = localStorage.getItem(PIN_KEY) || null;
  let pendingInvoice = null;
  let refreshTimer = null;

  function authHeaders() {
    return { "X-Dashboard-Pin": pin || "" };
  }

  /* ---------- نغمة تأكيد الجاهزية ---------- */

  let audioCtx = null;

  function initAudio() {
    try {
      audioCtx =
        audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state !== "running") audioCtx.resume();
    } catch (e) {
      /* audio unsupported */
    }
  }

  document.addEventListener("pointerdown", initAudio);

  function playReadyChime() {
    if (!audioCtx || audioCtx.state !== "running") return;
    try {
      const t0 = audioCtx.currentTime;
      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 12;
      comp.attack.value = 0.002;
      comp.release.value = 0.2;
      const master = audioCtx.createGain();
      master.gain.value = 2.6;
      master.connect(comp);
      comp.connect(audioCtx.destination);

      const round = [
        [880, 0, 0.32],
        [1108.73, 0.3, 0.32],
        [1318.51, 0.6, 0.55],
      ];
      const melody = [];
      [0, 1.25, 2.5].forEach((offset) => {
        round.forEach(([f, d, dur]) => melody.push([f, d + offset, dur]));
      });

      melody.forEach(([freq, delay, dur]) => {
        [
          [1, 1.0],
          [2, 0.45],
        ].forEach(([mult, vol]) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq * mult;
          gain.gain.setValueAtTime(0.0001, t0 + delay);
          gain.gain.exponentialRampToValueAtTime(vol, t0 + delay + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
          osc.connect(gain);
          gain.connect(master);
          osc.start(t0 + delay);
          osc.stop(t0 + delay + dur + 0.05);
        });
      });
    } catch (e) {
      /* best-effort */
    }
  }

  /* ---------- PIN ---------- */

  async function tryLogin(candidate) {
    try {
      const res = await fetch("/api/dashboard/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: candidate }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  function unlock() {
    pinScreen.classList.add("hidden");
    dashMain.classList.remove("hidden");
    ratingsPanel.classList.remove("hidden");
    refresh();
    refreshRatings();
    if (!refreshTimer) {
      refreshTimer = setInterval(() => {
        refresh();
        refreshRatings();
      }, cfg.POLL_INTERVAL_MS || 2500);
    }
  }

  function lock() {
    localStorage.removeItem(PIN_KEY);
    pin = null;
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    dashMain.classList.add("hidden");
    ratingsPanel.classList.add("hidden");
    pinScreen.classList.remove("hidden");
    pinInput.value = "";
    pinInput.focus();
  }

  async function submitPin() {
    const candidate = pinInput.value.trim();
    pinError.classList.add("hidden");
    if (candidate.length !== 4) {
      pinError.textContent = "الرمز مكوّن من 4 أرقام";
      pinError.classList.remove("hidden");
      return;
    }
    pinBtn.disabled = true;
    const ok = await tryLogin(candidate);
    pinBtn.disabled = false;
    if (ok) {
      pin = candidate;
      localStorage.setItem(PIN_KEY, pin);
      unlock();
    } else {
      pinError.textContent = "الرمز غير صحيح، حاول مرة أخرى";
      pinError.classList.remove("hidden");
      pinInput.value = "";
      pinInput.focus();
    }
  }

  pinBtn.addEventListener("click", submitPin);
  pinInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitPin();
  });

  /* ---------- Orders ---------- */

  function formatWait(createdAt) {
    const secs = Math.max(0, Math.floor(Date.now() / 1000 - createdAt));
    const mins = Math.floor(secs / 60);
    if (mins < 1) return "الآن";
    return `منذ ${mins} دقيقة`;
  }

  function render(orders) {
    pendingCount.textContent = orders.length;
    if (orders.length === 0) {
      grid.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");
    grid.innerHTML = orders
      .map(
        (o) => `
        <div class="order-card" data-invoice="${o.invoice}">
          <div class="order-num">#${o.invoice}</div>
          <div class="order-wait">${formatWait(o.created_at)}</div>
        </div>`
      )
      .join("");
    grid.querySelectorAll(".order-card").forEach((card) => {
      card.addEventListener("click", () => openConfirm(card.dataset.invoice));
    });
  }

  async function refresh() {
    try {
      const res = await fetch("/api/orders", { headers: authHeaders() });
      if (res.status === 401) {
        lock();
        return;
      }
      const data = await res.json();
      render(data);
    } catch (e) {
      /* keep last render on network hiccup */
    }
  }

  /* ---------- Ratings ---------- */

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatAgo(createdAt) {
    const secs = Math.max(0, Math.floor(Date.now() / 1000 - createdAt));
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days >= 1) return `منذ ${days} يوم`;
    if (hours >= 1) return `منذ ${hours} ساعة`;
    if (mins >= 1) return `منذ ${mins} دقيقة`;
    return "الآن";
  }

  function renderRatings(items) {
    ratingsCount.textContent = items.length;
    const rated = items.filter((f) => f.rating > 0);
    if (rated.length) {
      const avg = rated.reduce((s, f) => s + f.rating, 0) / rated.length;
      avgRating.textContent = `★ ${avg.toFixed(1)} من 5`;
    } else {
      avgRating.textContent = "—";
    }
    if (items.length === 0) {
      ratingsList.innerHTML = "";
      ratingsEmpty.classList.remove("hidden");
      return;
    }
    ratingsEmpty.classList.add("hidden");
    ratingsList.innerHTML = items
      .map(
        (f) => `
        <div class="rating-item">
          <div class="rating-head">
            <span class="rating-stars">${"★".repeat(f.rating)}<span class="off">${"★".repeat(5 - f.rating)}</span></span>
            ${f.invoice ? `<span class="rating-invoice">#${escapeHtml(f.invoice)}</span>` : ""}
            <span class="rating-date">${formatAgo(f.created_at)}</span>
          </div>
          ${f.text ? `<p class="rating-text">${escapeHtml(f.text)}</p>` : ""}
        </div>`
      )
      .join("");
  }

  async function refreshRatings() {
    try {
      const res = await fetch("/api/feedback", { headers: authHeaders() });
      if (!res.ok) return;
      renderRatings(await res.json());
    } catch (e) {
      /* keep last render */
    }
  }

  function openConfirm(invoice) {
    pendingInvoice = invoice;
    confirmInvoiceNum.textContent = invoice;
    confirmOverlay.classList.remove("hidden");
  }

  function closeConfirm() {
    pendingInvoice = null;
    confirmOverlay.classList.add("hidden");
  }

  cancelConfirmBtn.addEventListener("click", closeConfirm);

  doConfirmBtn.addEventListener("click", async () => {
    if (!pendingInvoice) return;
    doConfirmBtn.disabled = true;
    try {
      await fetch(`/api/orders/${encodeURIComponent(pendingInvoice)}/ready`, {
        method: "POST",
        headers: authHeaders(),
      });
      playReadyChime();
    } finally {
      doConfirmBtn.disabled = false;
      closeConfirm();
      refresh();
    }
  });

  /* ---------- Boot ---------- */

  (async function boot() {
    if (pin && (await tryLogin(pin))) {
      unlock();
    } else {
      lock();
    }
  })();
})();
