import express from "express";

import {
  getAccounts,
  setAccountBalance,
  getRates,
  setRate,
  getLog,
  exchange,
} from "./exchange.js";


const app = express();
const port = 3000;

app.use(express.json());

// ACCOUNT endpoints

app.get("/accounts", async (req, res) => {
  let data = await getAccounts();
  console.log(data);
  res.json(data);
});

app.put("/accounts/:id/balance", (req, res) => {
  const accountId = req.params.id;
  const { balance } = req.body;

  if (!accountId || !balance) {
    return res.status(400).json({ error: "Malformed request" });
  } else {
    setAccountBalance(accountId, balance);

    res.json(getAccounts());
  }
});

// RATE endpoints

app.get("/rates", async (req, res) => {
  let data = await getRates();
  console.log(data);
  res.json(data);
});

app.put("/rates", (req, res) => {
  const { baseCurrency, counterCurrency, rate } = req.body;

  if (!baseCurrency || !counterCurrency || !rate) {
    return res.status(400).json({ error: "Malformed request" });
  }

  const newRateRequest = { ...req.body };
  setRate(newRateRequest);

  res.json(getRates());
});

// LOG endpoint

app.get("/log", async (req, res) => {
  let data = await getLog();
  console.log(data);
  res.json(data);
});

// EXCHANGE endpoint

app.post("/exchange", async (req, res) => {
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId,
    counterAccountId,
    baseAmount,
  } = req.body;

  if (
    !baseCurrency ||
    !counterCurrency ||
    !baseAccountId ||
    !counterAccountId ||
    !baseAmount
  ) {
    return res.status(400).json({ error: "Malformed request" });
  }

  const exchangeRequest = { ...req.body };
  const exchangeResult = await exchange(exchangeRequest);

  if (exchangeResult.ok) {
    res.status(200).json(exchangeResult);
  } else {
    console.log("ERROR 500");
    res.status(500).json(exchangeResult);
  }
});

app.listen(port, () => {
  console.log(`Exchange API listening on port ${port}`);
});

export default app;
