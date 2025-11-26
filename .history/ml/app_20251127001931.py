# ml/app.py
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from typing import Any, Dict, List, Optional, Union
import joblib
import os
import numpy as np
import traceback

app = FastAPI(title="heart-ml")

FEATURES = ["age","sex","cp","trestbps","chol","fbs","restecg",
            "thalach","exang","oldpeak","slope","ca","thal"]

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

@app.get("/readyz")
def readyz():
    model = get_model()
    if model is None:
        return {"ready": False, "model_loaded": False}
    return {"ready": True, "model_loaded": True}

# Loose Pydantic model: accepts either an 'input' map/list or 'values' single row/list-of-rows
class PredictIn(BaseModel):
    input: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None
    values: Optional[Union[List[float], List[List[float]]]] = None

def _as_batch_from_payload(payload: PredictIn) -> List[List[float]]:
    """
    Return a list-of-rows (each row is a list of feature values in FEATURES order).
    """
    if payload.values is not None:
        vals = payload.values
        # If values is list of floats -> single row; if list-of-lists -> batch
        if len(vals) == 0:
            raise HTTPException(status_code=400, detail="Empty 'values' provided")
        # Distinguish between nested lists and flat list
        if all(isinstance(x, (int, float)) for x in vals):
            # single row
            return [vals]
        if all(isinstance(x, list) for x in vals):
            return vals
        raise HTTPException(status_code=400, detail="'values' must be a list of numbers (single row) or list-of-lists (batch)")
    if payload.input is not None:
        inp = payload.input
        if isinstance(inp, dict):
            # single map -> build one row following FEATURES order
            return [[inp.get(f, 0) for f in FEATURES]]
        if isinstance(inp, list):
            # list of maps -> convert to rows
            rows = []
            for item in inp:
                if not isinstance(item, dict):
                    raise HTTPException(status_code=400, detail="When 'input' is a list, each item must be an object/map")
                rows.append([item.get(f, 0) for f in FEATURES])
            return rows
    raise HTTPException(status_code=422, detail="Missing 'input' map/list or 'values' list")

@app.post("/predict")
def predict(payload: PredictIn):
    model = get_model()
    if model is None:
        raise HTTPException(status_code=503, detail="Model not available")

    try:
        rows = _as_batch_from_payload(payload)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    try:
        X = np.array(rows, dtype=float)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid feature vector shape or non-numeric values")

    try:
        preds = model.predict(X).tolist()
        probs = None
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X)[:, 1].tolist()
        # return single result object if single-row input, else batch
        if len(preds) == 1:
            return {"prediction": int(preds[0]), "probability": (float(probs[0]) if probs is not None else None)}
        return {"predictions": [int(p) for p in preds], "probabilities": (probs if probs is not None else None)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {e}\n{traceback.format_exc()}")
