const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Backend running 👌");
});

app.post("/api/predict", (req, res) => {
  const python = spawn("py", [
    path.join(__dirname, "..", "ml", "predict.py")
  ]);

  let output = "";
  let errorData = "";

  python.stdin.write(JSON.stringify(req.body));
  python.stdin.end();

  python.stdout.on("data", (data) => output += data.toString());
  python.stderr.on("data", (data) => errorData += data.toString());

  python.on("close", () => {
    if (errorData) console.log("Python error:", errorData);

    try {
      res.json(JSON.parse(output));
    } catch (err) {
      res.status(500).json({ error: "Invalid JSON from Python", raw: output });
    }
  });
});

app.listen(5000, () => {
  console.log("Backend running at http://localhost:5000");
});
