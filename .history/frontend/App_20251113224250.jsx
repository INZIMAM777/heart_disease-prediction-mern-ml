// frontend/src/App.jsx
import React, { useState } from "react";
import axios from "axios";

export default function App() {
  const initial = {
    age: 55,
    sex: 1,
    cp: 3,
    trestbps: 140,
    chol: 250,
    fbs: 0,
    restecg: 1,
    thalach: 150,
    exang: 0,
    oldpeak: 1.0,
    slope: 2,
    ca: 0,
    thal: 2
  };

  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value === "" ? "" : Number(value) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await axios.post("http://localhost:5000/api/predict", { input: form });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ======================= CSS MERGED HERE ======================= */}
      <style>{`
        body {
          font-family: "Poppins", Arial, sans-serif;
          background: #f5f7fa;
          margin: 0;
          padding: 0;
        }

        .container {
          max-width: 900px;
          margin: 30px auto;
          background: #ffffff;
          padding: 30px;
          border-radius: 16px;
          box-shadow: 0px 4px 12px rgba(0,0,0,0.1);
        }

        h1 {
          text-align: center;
          font-size: 32px;
          margin-bottom: 25px;
          color: #333;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 20px;
          margin-bottom: 25px;
        }

        .field {
          display: flex;
          flex-direction: column;
          font-size: 14px;
          font-weight: 500;
        }

        .field span {
          margin-bottom: 6px;
          color: #444;
        }

        .field input {
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 6px;
          font-size: 15px;
          transition: 0.2s ease;
        }

        .field input:focus {
          border-color: #007bff;
          outline: none;
          box-shadow: 0px 0px 4px rgba(0,123,255,0.3);
        }

        .btn {
          width: 100%;
          padding: 14px;
          background: #007bff;
          color: white;
          font-size: 16px;
          font-weight: 600;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .btn:hover {
          background: #005ec7;
        }

        .btn:disabled {
          background: #999;
          cursor: not-allowed;
        }

        .result {
          margin-top: 25px;
          padding: 20px;
          background: #eaf8ff;
          border-left: 6px solid #007bff;
          border-radius: 10px;
        }

        .result h2 {
          margin: 0;
          color: #007bff;
        }

        .result p {
          font-size: 16px;
          margin: 8px 0;
        }

        .error {
          margin-top: 20px;
          padding: 15px;
          background: #ffe7e7;
          color: #b30000;
          border-left: 6px solid #ff3b3b;
          border-radius: 10px;
          font-size: 14px;
          white-space: pre-wrap;
        }
      `}</style>
      {/* =============================================================== */}

      <div className="container">
        <h1>Heart Disease Predictor</h1>

        <form className="form" onSubmit={submit}>
          <div className="grid">
            {Object.keys(initial).map((key) => (
              <label className="field" key={key}>
                <span>{key}</span>
                <input
                  name={key}
                  value={form[key]}
                  onChange={handleChange}
                  type="number"
                  step={key === "oldpeak" ? "0.1" : "1"}
                  required
                />
              </label>
            ))}
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Predicting..." : "Predict"}
          </button>
        </form>

        {error && <pre className="error">{JSON.stringify(error, null, 2)}</pre>}

        {result && (
          <div className="result">
            <h2>Prediction</h2>
            <p>
              Risk:{" "}
              <strong>
                {result.prediction === 1
                  ? "High (Heart disease likely)"
                  : "Low (No heart disease predicted)"}
              </strong>
            </p>

            {result.probability !== null && (
              <p>
                Probability (model):{" "}
                <strong>{(result.probability * 100).toFixed(1)}%</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
