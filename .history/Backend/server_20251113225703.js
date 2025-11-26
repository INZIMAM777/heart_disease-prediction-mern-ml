const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// FIXED ROUTE: now matches frontend
app.post("/api/predict", (req, res) => {
  const inputData = req.body;

  const pythonProcess = spawn("python", [
    path.join(__dirname, "..", "ml", "predict.py")
  ]);

  let output = "";
  let errorOutput = "";

  pythonProcess.stdin.write(JSON.stringify(inputData));
  pythonProcess.stdin.end();

  pythonProcess.stdout.on("data", (data) => {
    output += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    errorOutput += data.toString();
  });

  pythonProcess.on("close", () => {
    if (errorOutput) {
      console.log("Python error:", errorOutput);
    }

    try {
      const result = JSON.parse(output);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: "Invalid JSON from Python",
        raw: output
      });
    }
  });
});

app.listen(5000, () => {
  console.log("Backend running on http://localhost:5000");
});
