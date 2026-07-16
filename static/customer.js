(function () {
  const cfg = window.KIFFA_CONFIG || {};
  const viewEntry = document.getElementById("view-entry");
  const viewWaiting = document.getElementById("view-waiting");
  const viewReady = document.getElementById("view-ready");
  const viewThanks = document.getElementById("view-thanks");
  const invoiceInput = document.getElementById("invoice-input");
  const confirmBtn = document.getElementById("confirm-btn");
  const entryError = document.getElementById("entry-error");
  const waitingInvoiceNum = document.getElementById("waiting-invoice-num");
  const readyInvoiceNum = document.getElementById("ready-invoice-num");
  const toast = document.getElementById("toast");
  const modalOverlay = document.getElementById("modal-overlay");

  const STORAGE_KEY = "kiffa_invoice";
  const LANG_KEY = "kiffa_lang";

  document.getElementById("review-link").href = cfg.MAPS_URL || "#";

  /* ---------- اللغة (عربي / إنجليزي) ---------- */

  const I18N = {
    ar: {
      dir: "rtl",
      tagline: "الدغدغة جايتك!",
      entry_title: "تابع طلبك من فرع الدائري",
      entry_sub: "أدخل رقم الفاتورة واضغط تأكيد، وبنعلمك أول ما يكون طلبك جاهز.",
      invoice_label: "رقم الفاتورة",
      invoice_ph: "مثال: 18",
      confirm_btn: "تأكيد",
      confirming: "جاري التأكيد...",
      err_empty: "الرجاء إدخال رقم الفاتورة",
      err_duplicate: "رقم الفاتورة هذا مسجّل مسبقاً وطلبه قيد التحضير",
      err_network: "تعذر الاتصال، حاول مرة أخرى",
      waiting_badge: "جاري تحضير طلبك على قدم وساق",
      waiting_text:
        "نقدّر لك صبرك<br/>فريقنا يحضر طلبك بكل حبّ واهتمام<br/><br/>راح توصلك رسالة هنا أول مايكون جاهز",
      ready_title: "طلبك جاهز!",
      ready_before: "تفضّل لاستلام طلب رقم ",
      ready_after: " من الكاونتر",
      thanks_title: "يا أبهى من طلّ وأعزّ من زارنا",
      thanks_sub: "بالعافية عليك",
      modal_topbar: "طلبــك جاهـــز",
      rating_title: "تقييمك يهمنا ورضاك غايتنا",
      note_title: "واجهتك ملاحظة؟",
      note_sub: "رضاك غايتنا واحنا هنا لخدمتك",
      wa_btn: "تواصل معنا عبر واتساب",
      wa_msg: "مرحباً كفة، عندي ملاحظة على طلبي",
      support_title: "ارتقت التجربة لذائقتك؟",
      support_sub: "ادعمنا بتقييمك",
      review_btn: "قيّمنا على خرائط جوجل ⭐",
      close_btn: "إغلاق",
      toast_ready: (inv) => `طلبك رقم ${inv} جاهز، تفضّل لاستلامه ✨`,
      toast_thanks: "شكراً لتقييمك، نقدّر وقتك 🌿",
      notif_title: "طلبك جاهز! ☕",
      notif_body: (inv) => `فاتورة رقم ${inv} جاهزة للاستلام من كفة`,
      branch_name: cfg.BRANCH_NAME || "فرع كفة",
      branch_addr: cfg.BRANCH_ADDRESS || "",
    },
    en: {
      dir: "ltr",
      tagline: "Your treat is on the way!",
      entry_title: "Track your order — King Abdullah Rd Branch",
      entry_sub:
        "Enter your invoice number and tap Confirm — we'll let you know the moment your order is ready.",
      invoice_label: "Invoice number",
      invoice_ph: "e.g. 18",
      confirm_btn: "Confirm",
      confirming: "Confirming...",
      err_empty: "Please enter your invoice number",
      err_duplicate: "This invoice number is already registered and being prepared",
      err_network: "Connection failed, please try again",
      waiting_badge: "Your order is being prepared",
      waiting_text:
        "We appreciate your patience<br/>Our team is preparing your order with love and care<br/><br/>You'll get a message here the moment it's ready",
      ready_title: "Your order is ready!",
      ready_before: "Please collect order #",
      ready_after: " from the counter",
      thanks_title: "It was an honor to serve you",
      thanks_sub: "Enjoy!",
      modal_topbar: "YOUR ORDER IS READY",
      rating_title: "Your feedback matters to us",
      note_title: "Something wasn't right?",
      note_sub: "Your satisfaction is our goal — we're here for you",
      wa_btn: "Contact us on WhatsApp",
      wa_msg: "Hi KIFFA, I have a note about my order",
      support_title: "Enjoyed the experience?",
      support_sub: "Support us with a review",
      review_btn: "Rate us on Google Maps ⭐",
      close_btn: "Close",
      toast_ready: (inv) => `Order #${inv} is ready — come pick it up ✨`,
      toast_thanks: "Thanks for your feedback 🌿",
      notif_title: "Your order is ready! ☕",
      notif_body: (inv) => `Invoice #${inv} is ready for pickup at KIFFA`,
      branch_name: cfg.BRANCH_NAME_EN || cfg.BRANCH_NAME || "KIFFA Branch",
      branch_addr: cfg.BRANCH_ADDRESS_EN || cfg.BRANCH_ADDRESS || "",
    },
  };

  let lang = localStorage.getItem(LANG_KEY) === "en" ? "en" : "ar";
  const langToggle = document.getElementById("lang-toggle");

  function t(key, arg) {
    const v = I18N[lang][key];
    return typeof v === "function" ? v(arg) : v;
  }

  function applyLang() {
    const dict = I18N[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = dict.dir;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = dict[el.dataset.i18n];
      if (typeof v === "string") el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      const v = dict[el.dataset.i18nPh];
      if (typeof v === "string") el.placeholder = v;
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const v = dict[el.dataset.i18nHtml];
      if (typeof v === "string") el.innerHTML = v;
    });
    document.getElementById("branch-name").textContent = dict.branch_name;
    document.getElementById("branch-addr").textContent = dict.branch_addr;
    document.getElementById("whatsapp-link").href =
      "https://wa.me/966547528371?text=" + encodeURIComponent(dict.wa_msg);
    langToggle.textContent = lang === "ar" ? "EN" : "عربي";
    localStorage.setItem(LANG_KEY, lang);
  }

  langToggle.addEventListener("click", () => {
    lang = lang === "ar" ? "en" : "ar";
    applyLang();
  });
  applyLang();

  let pollTimer = null;

  function showView(view) {
    [viewEntry, viewWaiting, viewReady, viewThanks].forEach((v) =>
      v.classList.add("hidden")
    );
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

  /* ---------- Ready chime ---------- */

  // المتصفح ما يسمح بالصوت إلا بعد تفاعل من المستخدم،
  // فنجهّز الصوت عند كل لمسة (آيفون يعلّق الصوت باستمرار فنعيد تفعيله)
  let audioCtx = null;
  let mediaChannelUnlocked = false;

  // مقطع صامت يعيد توجيه صوت الموقع لقناة الوسائط في آيفون
  // (بدلاً من قناة الرنين التي يكتمها زر الصامت)
  const SILENT_WAV =
    "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

  function initAudio() {
    try {
      audioCtx =
        audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state !== "running") audioCtx.resume();
      if (!mediaChannelUnlocked) {
        mediaChannelUnlocked = true;
        const keeper = new Audio(SILENT_WAV);
        keeper.loop = true;
        keeper.volume = 0.01;
        keeper.play().catch(() => {
          mediaChannelUnlocked = false;
        });
      }
    } catch (e) {
      /* audio unsupported */
    }
  }

  document.addEventListener("pointerdown", initAudio);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && audioCtx && audioCtx.state !== "running") {
      audioCtx.resume().catch(() => {});
    }
  });

  function playReadyChime() {
    if (!audioCtx) return;
    // آيفون يعلّق الصوت عند قفل الشاشة — نعيد تفعيله ثم نشغّل الرنة
    if (audioCtx.state !== "running") {
      audioCtx
        .resume()
        .then(() => scheduleChimeTones())
        .catch(() => {});
      return;
    }
    scheduleChimeTones();
  }

  function scheduleChimeTones() {
    try {
      const t0 = audioCtx.currentTime;
      // لحن صاعد من ثلاث نغمات يتكرر مرتين (~2.5 ثانية) بصوت عالي
      [
        [880, 0, 0.32],
        [1108.73, 0.3, 0.32],
        [1318.51, 0.6, 0.5],
        [880, 1.3, 0.32],
        [1108.73, 1.6, 0.32],
        [1318.51, 1.9, 0.65],
      ].forEach(([freq, delay, dur]) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + delay);
        gain.gain.exponentialRampToValueAtTime(0.85, t0 + delay + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0 + delay);
        osc.stop(t0 + delay + dur + 0.05);
      });
    } catch (e) {
      /* best-effort */
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
        new Notification(t("notif_title"), {
          body: t("notif_body", invoice),
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
    playReadyChime();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    fireLocalNotification(invoice);
    showToast(t("toast_ready", invoice));
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
      entryError.textContent = t("err_empty");
      entryError.classList.remove("hidden");
      return;
    }
    // نفس الجهاز اللي سجّل الرقم: نرجّعه لشاشة المتابعة بدل رفضه
    if (localStorage.getItem(STORAGE_KEY) === invoice) {
      enterWaiting(invoice);
      return;
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = t("confirming");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice }),
      });
      if (res.status === 409) {
        entryError.textContent = t("err_duplicate");
        entryError.classList.remove("hidden");
        return;
      }
      if (!res.ok) throw new Error("failed");
      enterWaiting(invoice);
    } catch (e) {
      entryError.textContent = t("err_network");
      entryError.classList.remove("hidden");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = t("confirm_btn");
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
    showToast(t("toast_thanks"));
    setTimeout(() => {
      closeModal();
      showView(viewThanks);
    }, 1600);
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
    if (ratingSubmitted) showView(viewThanks);
  }

  document.getElementById("close-modal-btn").addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
})();
