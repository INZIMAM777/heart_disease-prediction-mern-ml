// frontend/src/App.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";

export default function App() {
  // Enhanced initial values with better descriptions
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

  // Field descriptions for better user understanding
  const fieldDescriptions = {
    age: { label: "Age", description: "Your current age in years" },
    sex: { 
      label: "Gender", 
      description: "Biological sex",
      options: { 0: "Female", 1: "Male" }
    },
    cp: { 
      label: "Chest Pain Type", 
      description: "Type of chest pain experienced",
      options: {
        1: "Typical Angina",
        2: "Atypical Angina", 
        3: "Non-anginal Pain",
        4: "Asymptomatic"
      }
    },
    trestbps: { label: "Resting Blood Pressure", description: "Resting blood pressure (mm Hg)" },
    chol: { label: "Cholesterol", description: "Serum cholesterol level (mg/dl)" },
    fbs: { 
      label: "Fasting Blood Sugar", 
      description: "Fasting blood sugar > 120 mg/dl",
      options: { 0: "No", 1: "Yes" }
    },
    restecg: { 
      label: "Resting ECG", 
      description: "Resting electrocardiographic results",
      options: {
        0: "Normal",
        1: "ST-T Wave Abnormality", 
        2: "Left Ventricular Hypertrophy"
      }
    },
    thalach: { label: "Max Heart Rate", description: "Maximum heart rate achieved" },
    exang: { 
      label: "Exercise Angina", 
      description: "Angina induced by exercise",
      options: { 0: "No", 1: "Yes" }
    },
    oldpeak: { label: "ST Depression", description: "ST depression induced by exercise relative to rest" },
    slope: { 
      label: "ST Segment Slope", 
      description: "Slope of the peak exercise ST segment",
      options: {
        1: "Upsloping",
        2: "Flat", 
        3: "Downsloping"
      }
    },
    ca: { label: "Major Vessels", description: "Number of major vessels colored by fluoroscopy (0-3)" },
    thal: { 
      label: "Thalassemia", 
      description: "Blood disorder called thalassemia",
      options: {
        1: "Normal",
        2: "Fixed Defect", 
        3: "Reversible Defect"
      }
    }
  };

  // Normal ranges for guidance
  const normalRanges = {
    trestbps: { min: 90, max: 120, unit: "mm Hg" },
    chol: { min: 125, max: 200, unit: "mg/dl" },
    thalach: { min: 60, max: 100, unit: "bpm" },
    oldpeak: { min: 0, max: 1, unit: "" }
  };

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      * {
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%);
        margin: 0;
        padding: 20px;
        min-height: 100vh;
        color: #2d3748;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        background: #ffffff;
        padding: 40px;
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
      }

      .header {
        text-align: center;
        margin-bottom: 40px;
      }

      .header h1 {
        font-size: 2.5rem;
        margin: 0 0 10px 0;
        background: linear-gradient(135deg, #007bff, #0056b3);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 700;
      }

      .header p {
        font-size: 1.1rem;
        color: #718096;
        margin: 0;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
        line-height: 1.6;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 25px;
        margin-bottom: 35px;
      }

      .field-group {
        background: #f8fafc;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        transition: all 0.3s ease;
      }

      .field-group:hover {
        background: #f1f5f9;
        border-color: #cbd5e0;
      }

      .field-header {
        display: flex;
        justify-content: between;
        align-items: flex-start;
        margin-bottom: 12px;
      }

      .field-label {
        font-weight: 600;
        color: #2d3748;
        font-size: 1rem;
        margin-bottom: 4px;
      }

      .field-description {
        font-size: 0.85rem;
        color: #718096;
        line-height: 1.4;
        margin-bottom: 12px;
      }

      .input-wrapper {
        position: relative;
      }

      .field-input {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        font-size: 1rem;
        transition: all 0.3s ease;
        background: white;
      }

      .field-input:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
      }

      .field-input.select {
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
        background-position: right 12px center;
        background-repeat: no-repeat;
        background-size: 16px;
        padding-right: 40px;
      }

      .range-indicator {
        font-size: 0.75rem;
        color: #718096;
        margin-top: 6px;
        display: flex;
        justify-content: space-between;
      }

      .normal-range {
        color: #38a169;
        font-weight: 500;
      }

      .button-group {
        display: flex;
        gap: 15px;
        margin-top: 30px;
      }

      .btn {
        flex: 1;
        padding: 16px 24px;
        font-size: 1.1rem;
        font-weight: 600;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .btn-primary {
        background: linear-gradient(135deg, #007bff, #0056b3);
        color: white;
      }

      .btn-primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
      }

      .btn-secondary {
        background: #f7fafc;
        color: #4a5568;
        border: 2px solid #e2e8f0;
      }

      .btn-secondary:hover {
        background: #edf2f7;
        border-color: #cbd5e0;
      }

      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none !important;
      }

      .result-section {
        margin-top: 40px;
        animation: fadeIn 0.5s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .result-card {
        background: linear-gradient(135deg, #e6f3ff, #f0f7ff);
        border: 1px solid #bee3f8;
        border-radius: 16px;
        padding: 30px;
        text-align: center;
      }

      .result-high {
        background: linear-gradient(135deg, #fed7d7, #fff5f5);
        border-color: #feb2b2;
      }

      .result-title {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }

      .risk-high {
        color: #e53e3e;
      }

      .risk-low {
        color: #38a169;
      }

      .probability-meter {
        width: 100%;
        height: 12px;
        background: #e2e8f0;
        border-radius: 10px;
        margin: 20px 0;
        overflow: hidden;
      }

      .probability-fill {
        height: 100%;
        background: linear-gradient(90deg, #38a169, #e53e3e);
        border-radius: 10px;
        transition: width 1s ease;
      }

      .probability-text {
        font-size: 1.1rem;
        font-weight: 600;
        color: #2d3748;
      }

      .error-card {
        background: #fed7d7;
        border: 1px solid #feb2b2;
        border-radius: 12px;
        padding: 20px;
        color: #c53030;
        margin-top: 20px;
      }

      .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #ffffff;
        border-left: 2px solid transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @media (max-width: 768px) {
        .container {
          padding: 20px;
          margin: 10px;
        }
        
        .header h1 {
          font-size: 2rem;
        }
        
        .grid {
          grid-template-columns: 1fr;
        }
        
        .button-group {
          flex-direction: column;
        }
      }
    `;
    document.head.appendChild(style);

    return () => document.head.removeChild(style);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value === "" ? "" : Number(value) }));
  };

  const resetForm = () => {
    setForm(initial);
    setResult(null);
    setError(null);
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

  const renderInput = (key) => {
    const field = fieldDescriptions[key];
    const value = form[key];
    
    if (field.options) {
      return (
        <select 
          name={key} 
          value={value} 
          onChange={handleChange}
          className="field-input select"
          required
        >
          {Object.entries(field.options).map(([optValue, optLabel]) => (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          ))}
        </select>
      );
    }

    return (
      <>
        <input
          name={key}
          value={value}
          onChange={handleChange}
          type="number"
          step={key === "oldpeak" ? "0.1" : "1"}
          className="field-input"
          required
          min={key === "ca" ? 0 : key === "thal" ? 1 : undefined}
          max={key === "ca" ? 3 : key === "thal" ? 3 : undefined}
        />
        {normalRanges[key] && (
          <div className="range-indicator">
            <span>Your input: {value}</span>
            <span className="normal-range">
              Normal: {normalRanges[key].min}-{normalRanges[key].max} {normalRanges[key].unit}
            </span>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="container">
      <div className="header">
        <h1>❤️ Heart Disease Risk Assessment</h1>
        <p>
          Fill in your health information below to assess your risk of heart disease. 
          This tool uses machine learning to provide personalized insights based on clinical data.
        </p>
      </div>

      <form className="form" onSubmit={submit}>
        <div className="grid">
          {Object.keys(initial).map((key) => (
            <div className="field-group" key={key}>
              <div className="field-header">
                <div style={{flex: 1}}>
                  <div className="field-label">{fieldDescriptions[key].label}</div>
                  <div className="field-description">
                    {fieldDescriptions[key].description}
                  </div>
                </div>
              </div>
              <div className="input-wrapper">
                {renderInput(key)}
              </div>
            </div>
          ))}
        </div>

        <div className="button-group">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={resetForm}
            disabled={loading}
          >
            Reset Form
          </button>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Analyzing...
              </>
            ) : (
              "🔍 Assess My Risk"
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="error-card">
          <strong>⚠️ Error</strong>
          <pre style={{margin: '10px 0 0 0', whiteSpace: 'pre-wrap', fontSize: '14px'}}>
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
      )}

      {result && (
        <div className="result-section">
          <div className={`result-card ${result.prediction === 1 ? 'result-high' : ''}`}>
            <div className="result-title">
              {result.prediction === 1 ? '⚠️' : '✅'}
              <span className={result.prediction === 1 ? 'risk-high' : 'risk-low'}>
                {result.prediction === 1 
                  ? "Higher Risk Detected" 
                  : "Lower Risk Detected"
                }
              </span>
            </div>
            
            <p style={{fontSize: '1.1rem', marginBottom: '20px'}}>
              {result.prediction === 1 
                ? "Our analysis suggests a higher likelihood of heart disease. Please consult with a healthcare professional for proper evaluation."
                : "Our analysis suggests a lower likelihood of heart disease. Continue maintaining a healthy lifestyle!"
              }
            </p>

            {result.probability !== null && (
              <>
                <div className="probability-meter">
                  <div 
                    className="probability-fill" 
                    style={{ width: `${result.probability * 100}%` }}
                  ></div>
                </div>
                <div className="probability-text">
                  Risk Probability: <strong>{(result.probability * 100).toFixed(1)}%</strong>
                </div>
                <p style={{fontSize: '0.9rem', color: '#718096', marginTop: '10px'}}>
                  This percentage represents the model's confidence in the prediction
                </p>
              </>
            )}
          </div>
          
          <div style={{
            background: '#f0fff4', 
            border: '1px solid #9ae6b4', 
            borderRadius: '12px', 
            padding: '20px', 
            marginTop: '20px',
            textAlign: 'center'
          }}>
            <p style={{margin: 0, color: '#2f855a'}}>
              💡 <strong>Disclaimer:</strong> This tool is for informational purposes only. 
              Always consult with qualified healthcare professionals for medical advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}