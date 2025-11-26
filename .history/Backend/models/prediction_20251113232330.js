const mongoose = require("mongoose");

const PredictionSchema = new mongoose.Schema({
  input: { type: Object, required: true },
  prediction: { type: Number, required: true },
  probability: { type: Number },
  userId: { type: String, default: null }, // optional
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Prediction", PredictionSchema);
