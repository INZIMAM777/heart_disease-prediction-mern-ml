# ml/predict.py
import sys
import json
import numpy as np
import joblib
import traceback
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
FEATURES = [
    "age","sex","cp","trestbps","chol","fbs",
    "restecg","thalach","exang","oldpeak",
    "slope","ca","thal"
]

def safe_print(obj):
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()

def load_model():
    try:
        return joblib.load(MODEL_PATH)
    except Exception as e:
        return None, str(e)

def normalize(data):
    # returns list-of-rows
    if "input" in data:
        inp = data["input"]
        if isinstance(inp, dict):
            return [[inp.get(f, 0) for f in FEATURES]]
        if isinstance(inp, list):
            rows = []
            for item in inp:
                rows.append([item.get(f, 0) for f in FEATURES])
            return rows
    if "values" in data:
        vals = data["values"]
        if len(vals) == 0:
            return []
        if all(isinstance(x, (int, float)) for x in vals):
            return [vals]
        if all(isinstance(x, list) for x in vals):
            return vals
    return None

def main():
    model, err = load_model(), None
    if model is None:
        safe_print({"error": "Could not load model"})
        return

    raw = sys.stdin.read()
    if not raw:
        safe_print({"error": "No input received"})
        return

    try:
        data = json.loads(raw)
    except Exception:
        safe_print({"error": "Invalid JSON input"})
        return

    rows = normalize(data)
    if rows is None:
        safe_print({"error": "Invalid input structure; expect 'input' or 'values'."})
        return

    try:
        arr = np.array(rows, dtype=float)
    except Exception:
        safe_print({"error": "Invalid feature vector shape"})
        return

    try:
        preds = model.predict(arr).tolist()
        probs = None
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(arr)[:, 1].tolist()
        if len(preds) == 1:
            safe_print({"prediction": int(preds[0]), "probability": (float(probs[0]) if probs is not None else None)})
        else:
            safe_print({"predictions": [int(p) for p in preds], "probabilities": (probs if probs is not None else None)})
    except Exception:
        safe_print({"error": "Prediction error", "details": traceback.format_exc()})

if __name__ == "__main__":
    main()
