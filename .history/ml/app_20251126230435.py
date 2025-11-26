# ml/app.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import os
import numpy as np
import traceback

app = FastAPI()

MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(os.path.dirname(__file__), "model.pkl"))

_model = None
def get_model():
    global _model
    if _model is None:
        try:
            _model = joblib.load(MODEL_PATH)
            print("Model loaded from", MODEL_PATH)
        except Exception as e:
            print("Model load failed:", e)
            _model = None
    return _model

@app.get("/healthz")
def health():
    return {"status": "ok"}

class PredictIn(BaseModel):
    # accept either a mapping under "input" or a direct list under "values"
    input: dict | None = None
    values: list[float] | None = None

@app.post("/predict")
def predict(payload: PredictIn):
    features = ["age","sex","cp","trestbps","chol","fbs","restecg",
                "thalach","exang","oldpeak","slope","ca","thal"]

    model = get_model()
    if model is None:
        # If model not loaded, return helpful error (so backend can fall back or surface)
        raise HTTPException(status_code=500, detail="Model not available on server")

    # Build feature vector
    if payload.values is not None:
        vals = payload.values
    elif payload.input is not None:
        vals = [payload.input.get(f, 0) for f in features]
    else:
        raise HTTPException(status_code=400, detail="Missing 'input' map or 'values' list")

    try:
        X = np.array(vals).reshape(1, -1)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid feature vector shape")

    try:
        pred = int(model.predict(X)[0])
        prob = None
        if hasattr(model, "predict_proba"):
            prob = float(model.predict_proba(X)[0][1])
        return {"prediction": pred, "probability": prob}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {e}\n{traceback.format_exc()}")
