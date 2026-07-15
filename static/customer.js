(function () {
  const cfg = window.KIFFA_CONFIG || {};
  const viewEntry = document.getElementById("view-entry");
  const viewWaiting = document.getElementById("view-waiting");
  const viewReady = document.getElementById("view-ready");
  const invoiceInput = document.getElementById("invoice-input");
  const confirmBtn = document.getElementById("confirm-btn");
  const entryError = document.getElementById("entry-error");
  const waitingInvoiceNum = document.getElementById("waiting-invoice-num");
  const readyInvoiceNum = document.getElementById("ready-invoice-num");
  const toast = document.getElementById("toast");
  const modalOverlay = document.getElementById("modal-overlay");

  const STORAGE_KEY = "kiffa_invoice";

  document.getElementById("branch-name").textContent = cfg.BRANCH_NAME || "فرع كفة";
  document.getElementById("branch-addr").textContent = cfg.BRANCH_ADDRESS || "";
  document.getElementById("review-link").href = cfg.MAPS_URL || "#";

  let pollTimer = null;

  function showView(view) {
    [viewEntry, viewWaiting, viewReady].forEach((v) => v.classList.add("hidden"));
    view.classList.remove("hidden");
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /* ---------- Web Push ---------- */

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
    return output;
  }

  // Register the SW at page load so the site is installable as a PWA
  // even before the customer confirms an order.
  const swRegistration =
    "serviceWorker" in navigator
      ? navigator.serviceWorker.register("/sw.js").catch(() => null)
      : Promise.resolve(null);

  async function enablePush(invoice) {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      const reg = await swRegistration;
      if (!reg) return;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      await navigator.serviceWorker.ready;

      const keyRes = await fetch("/api/push/key");
      const { key } = await keyRes.json();

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      }

      await fetch(`/api/orders/${encodeURIComponent(invoice)}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
    } catch (e) {
      /* push is best-effort; polling remains the fallback */
      console.warn("push setup failed:", e);
    }
  }

  function fireLocalNotification(invoice) {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("طلبك جاهز! ☕", {
          body: `فاتورة رقم ${invoice} جاهزة للاستلام من كفة`,
          icon: "assets/pwa-icon-192.png",
        });
      } catch (e) {
        /* some platforms only allow notifications via SW */
      }
    }
  }

  /* ---------- Order flow ---------- */

  function onOrderReady(invoice) {
    stopPolling();
    localStorage.removeItem(STORAGE_KEY);
    readyInvoiceNum.textContent = invoice;
    showView(viewReady);
    fireLocalNotification(invoice);
    showToast(`طلبك رقم ${invoice} جاهز، تفضّل لاستلامه ✨`);
    setTimeout(openModal, 1600);
  }

  function enterWaiting(invoice) {
    localStorage.setItem(STORAGE_KEY, invoice);
    waitingInvoiceNum.textContent = invoice;
    showView(viewWaiting);
    enablePush(invoice);
    pollStatus(invoice);
  }

  function pollStatus(invoice) {
    stopPolling();
    pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(invoice)}/status`);
        const data = await res.json();
        if (data.status === "ready") {
          onOrderReady(invoice);
        } else if (data.status === "not_found") {
          stopPolling();
          localStorage.removeItem(STORAGE_KEY);
          showView(viewEntry);
        }
      } catch (e) {
        /* network hiccup, keep polling */
      }
    }, cfg.POLL_INTERVAL_MS || 2500);
  }

  // يحوّل الأرقام العربية (٢٠) والفارسية (۲۰) إلى إنجليزية (20)
  function normalizeDigits(s) {
    return s
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  }

  async function submitInvoice() {
    const invoice = normalizeDigits(invoiceInput.value.trim());
    entryError.classList.add("hidden");
    if (!invoice) {
      entryError.textContent = "الرجاء إدخال رقم الفاتورة";
      entryError.classList.remove("hidden");
      return;
    }
    // نفس الجهاز اللي سجّل الرقم: نرجّعه لشاشة المتابعة بدل رفضه
    if (localStorage.getItem(STORAGE_KEY) === invoice) {
      enterWaiting(invoice);
      return;
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = "جاري التأكيد...";
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice }),
      });
      if (res.status === 409) {
        entryError.textContent = "رقم الفاتورة هذا مسجّل مسبقاً وطلبه قيد التحضير";
        entryError.classList.remove("hidden");
        return;
      }
      if (!res.ok) throw new Error("failed");
      enterWaiting(invoice);
    } catch (e) {
      entryError.textContent = "تعذر الاتصال، حاول مرة أخرى";
      entryError.classList.remove("hidden");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "تأكيد";
    }
  }

  confirmBtn.addEventListener("click", submitInvoice);
  invoiceInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitInvoice();
  });

  /* Resume state if the customer returns to the page */
  (async function resume() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(saved)}/status`);
      const data = await res.json();
      if (data.status === "pending") {
        enterWaiting(saved);
      } else if (data.status === "ready") {
        onOrderReady(saved);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      /* server unreachable; stay on entry view */
    }
  })();

  /* ---------- Rating & modal ---------- */

  // اختيار النجوم يرسل التقييم تلقائياً بعد ثانية ونص من آخر ضغطة
  let selectedRating = 0;
  let ratingSubmitted = false;
  let ratingTimer = null;
  const starEls = document.querySelectorAll("#stars .star");

  async function submitRating() {
    if (ratingSubmitted || !selectedRating) return;
    ratingSubmitted = true;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice: readyInvoiceNum.textContent,
          rating: selectedRating,
          text: "",
        }),
      });
    } catch (e) {
      /* best-effort */
    }
    showToast("شكراً لتقييمك، نقدّر وقتك 🌿");
  }

  starEls.forEach((star) => {
    star.addEventListener("click", () => {
      if (ratingSubmitted) return;
      selectedRating = parseInt(star.dataset.v, 10);
      starEls.forEach((s) => {
        s.classList.toggle("filled", parseInt(s.dataset.v, 10) <= selectedRating);
      });
      clearTimeout(ratingTimer);
      ratingTimer = setTimeout(submitRating, 1500);
    });
  });

  function openModal() {
    modalOverlay.classList.remove("hidden");
  }
  function closeModal() {
    modalOverlay.classList.add("hidden");
  }

  document.getElementById("close-modal-btn").addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
})();
