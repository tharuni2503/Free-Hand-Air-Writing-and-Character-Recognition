import os
from pathlib import Path
import base64, binascii
from io import BytesIO
import numpy as np
from PIL import Image, ImageOps
from flask import Flask, jsonify, render_template, request
from tensorflow.keras.models import load_model

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent
_alpha_model = None
_num_model = None
ALPHA_LABELS = list("abcdefghijklmnopqrstuvwxyz") + [""]
NUM_LABELS = list("0123456789")

def get_models():
    global _alpha_model, _num_model
    if _alpha_model is None:
        _alpha_model = load_model(BASE_DIR / "bModel.h5", compile=False)
    if _num_model is None:
        _num_model = load_model(BASE_DIR / "bestmodel.h5", compile=False)
    return _alpha_model, _num_model

def preprocess_image(image):
    image = ImageOps.autocontrast(image.convert("L"))
    arr = np.asarray(image)
    ys, xs = np.where(arr > 40)
    if len(xs) == 0:
        raise ValueError("Draw a character before requesting recognition.")
    crop = Image.fromarray(arr[int(ys.min()):int(ys.max())+1, int(xs.min()):int(xs.max())+1])
    crop = crop.resize((28, 28), Image.Resampling.LANCZOS)
    crop = ImageOps.expand(crop, border=10, fill=0).resize((28, 28), Image.Resampling.LANCZOS)
    return (np.asarray(crop, dtype=np.float32) / 255.0).reshape(1, 28, 28, 1)

@app.get("/")
def home():
    return render_template("index.html")

@app.get("/feature")
def feature():
    return render_template("feature.html")

@app.get("/contact")
def contact():
    return render_template("contact.html")

@app.get("/health")
def health():
    return jsonify({"status": "ok"})

@app.post("/api/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    data_url = payload.get("image", "")
    mode = payload.get("mode", "alphabet")
    if mode not in ("alphabet", "number"):
        return jsonify({"error": "Mode must be alphabet or number."}), 400
    if not data_url.startswith("data:image/png;base64,"):
        return jsonify({"error": "Expected a PNG canvas image."}), 400
    try:
        raw = base64.b64decode(data_url.split(",", 1)[1], validate=True)
        if len(raw) > 4 * 1024 * 1024:
            return jsonify({"error": "Image is too large."}), 413
        image = Image.open(BytesIO(raw)).convert("RGB")
        tensor = preprocess_image(image)
        alpha_model, num_model = get_models()
        model = alpha_model if mode == "alphabet" else num_model
        labels = ALPHA_LABELS if mode == "alphabet" else NUM_LABELS
        scores = model.predict(tensor, verbose=0)[0]
        idx = int(np.argmax(scores))
        label = labels[idx] if idx < len(labels) else str(idx)
        return jsonify({"label": label.upper(), "confidence": round(float(scores[idx]), 4)})
    except (ValueError, binascii.Error) as exc:
        return jsonify({"error": str(exc) or "Could not read image."}), 400
    except Exception:
        app.logger.exception("Character prediction failed")
        return jsonify({"error": "Prediction failed. Check Render logs for model compatibility."}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
