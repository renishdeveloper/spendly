require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json({limit: "10kb"}));

// ---- Mongo connection ----
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is required (put it in .env)");
  process.exit(1);
}

mongoose.set("strictQuery", true);
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    const safe = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
    console.log("Mongo connected:", safe);
  })
  .catch((err) => {
    console.error("Mongo connection failed:", err.message);
    process.exit(1);
  });

// ---- Schema / model ----
const expenseSchema = new mongoose.Schema(
  {
    amount: {type: Number, required: true, min: 0.01},
    note: {type: String, default: "", maxlength: 200, trim: true},
    createdAt: {type: Number, default: () => Date.now(), index: true},
  },
  {versionKey: false},
);

const Expense = mongoose.model("Expense", expenseSchema);

const toDTO = (doc) => ({
  id: doc._id.toString(),
  amount: doc.amount,
  note: doc.note,
  createdAt: doc.createdAt,
});

// ---- Routes ----
app.get("/health", async (_req, res) => {
  try {
    const count = await Expense.countDocuments();
    res.json({ok: true, count});
  } catch (err) {
    res.status(500).json({ok: false, error: err.message});
  }
});

app.get("/expenses", async (_req, res) => {
  try {
    const docs = await Expense.find().sort({createdAt: -1}).limit(500).lean();
    res.json({expenses: docs.map(toDTO)});
  } catch (err) {
    res.status(500).json({error: err.message});
  }
});

app.post("/expenses", async (req, res) => {
  const {amount, note} = req.body || {};
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({error: "amount must be a positive number"});
  }

  try {
    const doc = await Expense.create({
      amount: numericAmount,
      note: typeof note === "string" ? note.slice(0, 200) : "",
    });
    console.log(
      `[+] expense ${doc._id}  amount=${doc.amount}  note="${doc.note}"`,
    );
    res.status(201).json(toDTO(doc));
  } catch (err) {
    res.status(500).json({error: err.message});
  }
});

app.delete("/expenses/:id", async (req, res) => {
  try {
    const doc = await Expense.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({error: "not found"});
    res.json(toDTO(doc));
  } catch (err) {
    res.status(400).json({error: "invalid id"});
  }
});

// ---- Start ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Spendly API listening on http://127.0.0.1:${PORT}`);
});
