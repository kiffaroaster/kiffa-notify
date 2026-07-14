import base64
import json
import os
import time
import threading
import warnings

warnings.filterwarnings("ignore")

from flask import Flask, request, jsonify, send_from_directory
from py_vapid import Vapid
from pywebpush import webpush, WebPushException
from cryptography.hazmat.primitives import serialization

app = Flask(__name__, static_folder="static", static_url_path="")
lock = threading.Lock()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VAPID_KEY_FILE = os.path.join(BASE_DIR, "vapid_private.pem")
VAPID_CLAIMS_SUB = "mailto:dohalhusyin@gmail.com"


def ensure_vapid_public_key():
    if not os.path.exists(VAPID_KEY_FILE):
        v = Vapid()
        v.generate_keys()
        v.save_key(VAPID_KEY_FILE)
    v = Vapid.from_file(VAPID_KEY_FILE)
    raw = v.public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


VAPID_PUBLIC_KEY = ensure_vapid_public_key()

# رمز دخول لوحة الكاشير — غيّره من Render عبر متغير البيئة DASHBOARD_PIN
DASHBOARD_PIN = os.environ.get("DASHBOARD_PIN", "1234")


def pin_ok():
    return request.headers.get("X-Dashboard-Pin") == DASHBOARD_PIN

# invoice_number -> {"status", "created_at", "ready_at", "subscription"}
orders = {}

# التقييمات: تُحفظ في ملف وتُحذف تلقائياً بعد 30 يوم
FEEDBACK_FILE = os.path.join(BASE_DIR, "feedback.json")
FEEDBACK_TTL_SECONDS = 30 * 24 * 3600


def load_feedbacks():
    try:
        with open(FEEDBACK_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


def prune_feedbacks(items):
    cutoff = time.time() - FEEDBACK_TTL_SECONDS
    return [x for x in items if x.get("created_at", 0) >= cutoff]


def save_feedbacks(items):
    with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False)


feedbacks = prune_feedbacks(load_feedbacks())


def send_push(subscription, invoice):
    payload = json.dumps(
        {
            "title": "طلبك جاهز! ☕",
            "body": f"فاتورة رقم {invoice} جاهزة للاستلام من كفة",
            "invoice": invoice,
        }
    )
    try:
        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=VAPID_KEY_FILE,
            vapid_claims={"sub": VAPID_CLAIMS_SUB},
        )
        app.logger.info("push sent for invoice %s", invoice)
    except WebPushException as e:
        app.logger.warning("push failed for invoice %s: %s", invoice, e)


@app.get("/")
def customer_page():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/dashboard")
def dashboard_page():
    return send_from_directory(app.static_folder, "dashboard.html")


@app.get("/api/push/key")
def push_key():
    return jsonify({"key": VAPID_PUBLIC_KEY})


@app.post("/api/feedback")
def add_feedback():
    global feedbacks
    data = request.get_json(silent=True) or {}
    text = str(data.get("text", "")).strip()[:500]
    try:
        rating = int(data.get("rating", 0))
    except (TypeError, ValueError):
        rating = 0
    rating = max(0, min(5, rating))
    if rating == 0 and not text:
        return jsonify({"error": "empty"}), 400
    entry = {
        "invoice": str(data.get("invoice", "")).strip()[:20],
        "rating": rating,
        "text": text,
        "created_at": time.time(),
    }
    with lock:
        feedbacks = prune_feedbacks(feedbacks)
        feedbacks.append(entry)
        save_feedbacks(feedbacks)
    return jsonify({"ok": True})


@app.get("/api/feedback")
def list_feedback():
    global feedbacks
    if not pin_ok():
        return jsonify({"error": "unauthorized"}), 401
    with lock:
        feedbacks = prune_feedbacks(feedbacks)
        items = list(reversed(feedbacks))
    return jsonify(items)


@app.post("/api/dashboard/verify")
def verify_pin():
    data = request.get_json(silent=True) or {}
    if str(data.get("pin", "")) == DASHBOARD_PIN:
        return jsonify({"ok": True})
    return jsonify({"ok": False}), 401


@app.get("/api/orders")
def list_pending():
    if not pin_ok():
        return jsonify({"error": "unauthorized"}), 401
    with lock:
        items = [
            {"invoice": inv, "created_at": o["created_at"]}
            for inv, o in orders.items()
            if o["status"] == "pending"
        ]
    items.sort(key=lambda x: x["created_at"])
    return jsonify(items)


@app.post("/api/orders")
def create_order():
    data = request.get_json(silent=True) or {}
    invoice = str(data.get("invoice", "")).strip()
    if not invoice:
        return jsonify({"error": "invoice_required"}), 400
    with lock:
        if invoice not in orders or orders[invoice]["status"] == "ready":
            orders[invoice] = {
                "status": "pending",
                "created_at": time.time(),
                "ready_at": None,
                "subscription": None,
            }
    return jsonify({"invoice": invoice, "status": orders[invoice]["status"]})


@app.post("/api/orders/<invoice>/subscribe")
def subscribe(invoice):
    sub = request.get_json(silent=True)
    if not sub or "endpoint" not in sub:
        return jsonify({"error": "invalid_subscription"}), 400
    with lock:
        o = orders.get(invoice)
        if not o:
            return jsonify({"error": "not_found"}), 404
        o["subscription"] = sub
    return jsonify({"ok": True})


@app.get("/api/orders/<invoice>/status")
def order_status(invoice):
    with lock:
        o = orders.get(invoice)
    if not o:
        return jsonify({"status": "not_found"})
    return jsonify({"status": o["status"]})


@app.post("/api/orders/<invoice>/ready")
def mark_ready(invoice):
    if not pin_ok():
        return jsonify({"error": "unauthorized"}), 401
    with lock:
        o = orders.get(invoice)
        if not o:
            return jsonify({"error": "not_found"}), 404
        o["status"] = "ready"
        o["ready_at"] = time.time()
        sub = o["subscription"]
    if sub:
        threading.Thread(target=send_push, args=(sub, invoice), daemon=True).start()
    return jsonify({"invoice": invoice, "status": "ready"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("RENDER") is None)
