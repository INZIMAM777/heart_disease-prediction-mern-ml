# ml/train.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score
import joblib

# Replace 'heart.csv' with your CSV filename
df = pd.read_csv("heart.csv")

# Example expected columns; adapt if your CSV differs
# Features:
features = ["age","sex","cp","trestbps","chol","fbs","restecg",
            "thalach","exang","oldpeak","slope","ca","thal"]
target = "target"

X = df[features]
y = df[target]

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", RandomForestClassifier(random_state=42, n_jobs=-1))
])

# Optional: quick grid search (small grid for speed)
param_grid = {
    "clf__n_estimators": [100, 200],
    "clf__max_depth": [5, 10, None]
}

grid = GridSearchCV(pipe, param_grid, cv=5, scoring="roc_auc", n_jobs=-1)
grid.fit(X_train, y_train)

best = grid.best_estimator_
print("Best params:", grid.best_params_)

# Evaluate
y_pred = best.predict(X_test)
y_prob = best.predict_proba(X_test)[:, 1]
print(classification_report(y_test, y_pred))
print("ROC AUC:", roc_auc_score(y_test, y_prob))

# Save
joblib.dump(best, "model.pkl")
print("Saved model to model.pkl")
