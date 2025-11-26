const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Backend running 👌");
});

// React will call this:
app.post("/api/predict", async (req, res) => {
  try {
    // Send input to FastAPI / Python API
    const response = await axios.post("http://localhost:8001/predict", req.body, { timeout: 15000 });

    res.json(response.data);
  } catch (err) {
    console.error("Prediction error:", err.message);
    res.status(500).json({
      error: "Prediction service failed",
      details: err.message
    });
  }
});

// Start backend server
app.listen(5000, () => {
  console.log("Backend running at http://localhost:5000");
});
