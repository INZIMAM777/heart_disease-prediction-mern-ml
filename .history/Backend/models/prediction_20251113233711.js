// backend/models/prediction.js
const mongoose = require("mongoose");

const PredictionSchema = new mongoose.Schema({
  // input features (adjust types if needed)
  age: { type: Number, required: true },
  sex: { type: Number, required: true },
  cp: { type: Number, required: true },
  trestbps: { type: Number, required: true },
  chol: { type: Number, required: true },
  fbs: { type: Number, required: true },
  restecg: { type: Number, required: true },
  thalach: { type: Number, required: true },
  exang: { type: Number, required: true },
  oldpeak: { type: Number, required: true },
  slope: { type: Number, required: true },
  ca: { type: Number, required: true },
  thal: { type: Number, required: true },

  // prediction results
  prediction: { type: Number, required: true }, // 0 or 1
  probability: { type: Number, default: null },

  // metadata
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Prediction", PredictionSchema);
