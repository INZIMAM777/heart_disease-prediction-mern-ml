# ml/predict.py
import sys
import json
import numpy as np
import joblib
import traceback

MODEL_PATH = "model.pkl"

def main():
    try:
        model = joblib.load(MODEL_PATH)
    except Exception as e:
        print(json.dumps({"error": f"Could not load model: {str(e)}"}))
        return

    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
        # Expect either {"values": [v1, v2, ...]} or {"input": {"age":..., ...}}
        if "values" in data:
            values = data["values"]
            arr = np.array(values).reshape(1, -1)
        elif "input" in data:
            # Map features in correct order
            features = ["age","sex","cp","trestbps","chol","fbs","restecg",
                        "thalach","exang","oldpeak","slope","ca","thal"]
            arr = np.array([data["input"].get(f, 0) for f in features]).reshape(1, -1)
        else:
            raise ValueError("Input JSON must contain 'values' or 'input' key")

        pred = model.predict(arr)[0]
        prob = float(model.predict_proba(arr)[0][1]) if hasattr(model, "predict_proba") else None

        result = {"prediction": int(pred), "probability": prob}
        print(json.dumps(result))
    except Exception as e:
        tb = traceback.format_exc()
        print(json.dumps({"error": str(e), "trace": tb}))

if __name__ == "__main__":
    main()
