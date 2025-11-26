# ml/predict.py
import sys
import json
import numpy as np
import joblib
import traceback
import os

# Always load model relative to this file
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

def safe_print(obj):
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()

def main():
    # Load model
    try:
        model = joblib.load(MODEL_PATH)
    except Exception as e:
        safe_print({"error": "Could not load model", "details": str(e)})
        return

    # Read input from Node
    try:
        raw = sys.stdin.read().strip()

        if not raw:
            safe_print({"error": "No input received"})
            return

        data = json.loads(raw)

        # Get features
        features = [
            "age","sex","cp","trestbps","chol","fbs",
            "restecg","thalach","exang","oldpeak",
            "slope","ca","thal"
        ]

        if "input" in data:
            values = [data["input"].get(f, 0) for f in features]
        elif "values" in data:
            values = data["values"]
        else:
            safe_print({"error": "Invalid input structure"})
            return

        arr = np.array(values).reshape(1, -1)

        # Predict
        pred = int(model.predict(arr)[0])
        prob = None
        if hasattr(model, "predict_proba"):
            prob = float(model.predict_proba(arr)[0][1])

        safe_print({"prediction": pred, "probability": prob})

    except Exception:
        safe_print({"error": "Prediction error", "details": traceback.format_exc()})

if __name__ == "__main__":
    main()
