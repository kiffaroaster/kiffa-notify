(function () {
  const cfg = window.KIFFA_CONFIG || {};
  const grid = document.getElementById("orders-grid");
  const emptyState = document.getElementById("empty-state");
  const pendingCount = document.getElementById("pending-count");
  const confirmOverlay = document.getElementById("confirm-overlay");
  const confirmInvoiceNum = document.getElementById("confirm-invoice-num");
  const cancelConfirmBtn = document.getElementById("cancel-confirm");
  const doConfirmBtn = document.getElementById("do-confirm");

  let pendingInvoice = null;

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
      const res = await fetch("/api/orders");
      const data = await res.json();
      render(data);
    } catch (e) {
      /* keep last render on network hiccup */
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
      });
    } finally {
      doConfirmBtn.disabled = false;
      closeConfirm();
      refresh();
    }
  });

  refresh();
  setInterval(refresh, cfg.POLL_INTERVAL_MS || 2500);
})();
