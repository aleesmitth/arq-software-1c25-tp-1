import { nanoid } from "nanoid";
import dotenv from 'dotenv';
import { createClient } from 'redis';
dotenv.config();

const client = createClient({
  username: 'mario',
  password: process.env.REDIS_PASSWORD, //'TParqsoft1!',
  socket: {
    host: 'redis-17076.c57.us-east-1-4.ec2.redns.redis-cloud.com',
    port: 17076,
  }
});

//returns all internal accounts
export async function getAccounts() {
  try {
    const dataString = await client.get("accounts"); // Retrieve string from Redis
    if (dataString) {
      return JSON.parse(dataString); // Convert string back to JSON
    } else {
      console.error(`No data found in Redis for key "${key}"`);
    }
  } catch (err) {
    console.error(`Error loading data from Redis with key "${key}":`, err);
  }
}

//sets balance for an account TODO!
export function setAccountBalance(accountId, balance) {
  const account = findAccountById(accountId);

  if (account != null) {
    account.balance = balance;
  }
}

//returns all current exchange rates
export async function getRates() {
  try {
    const dataString = await client.get("rates"); // Retrieve string from Redis
    if (dataString) {
      return JSON.parse(dataString); // Convert string back to JSON
    } else {
      console.error(`No data found in Redis for key "${key}"`);
    }
  } catch (err) {
    console.error(`Error loading data from Redis with key "${key}":`, err);
  }
}

//returns the whole transaction log
export async function getLog() {
  try {
    const dataString = await client.get("logs"); // Retrieve string from Redis
    if (dataString) {
      return JSON.parse(dataString); // Convert string back to JSON
    } else {
      console.error(`No data found in Redis for key "${key}"`);
    }
  } catch (err) {
    console.error(`Error loading data from Redis with key "${key}":`, err);
  }
}

//sets the exchange rate for a given pair of currencies, and the reciprocal rate as well
export async function setRate(rateRequest) {
  const { baseCurrency, counterCurrency, rate } = rateRequest;
  try {
    const dataString = JSON.stringify(data); // Convert JSON to string
    await client.set(key, dataString); // Store string in Redis
  } catch (err) {
    console.error(`Error saving data to Redis with key "${key}":`, err);
  }

  /*
  rates[baseCurrency][counterCurrency] = rate;
  rates[counterCurrency][baseCurrency] = Number((1 / rate).toFixed(5));
  */
}

//executes an exchange operation
export async function exchange(exchangeRequest) {
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId: clientBaseAccountId,
    counterAccountId: clientCounterAccountId,
    baseAmount,
  } = exchangeRequest;

  //get the exchange rate
  const exchangeRate = rates[baseCurrency][counterCurrency];
  //compute the requested (counter) amount
  const counterAmount = baseAmount * exchangeRate;
  //find our account on the provided (base) currency
  const baseAccount = findAccountByCurrency(baseCurrency);
  //find our account on the counter currency
  const counterAccount = findAccountByCurrency(counterCurrency);

  //construct the result object with defaults
  const exchangeResult = {
    id: nanoid(),
    ts: new Date(),
    ok: false,
    request: exchangeRequest,
    exchangeRate: exchangeRate,
    counterAmount: 0.0,
    obs: null,
  };

  //check if we have funds on the counter currency account
  if (counterAccount.balance >= counterAmount) {
    //try to transfer from clients' base account
    if (await transfer(clientBaseAccountId, baseAccount.id, baseAmount)) {
      //try to transfer to clients' counter account
      if (
        await transfer(counterAccount.id, clientCounterAccountId, counterAmount)
      ) {
        //all good, update balances
        baseAccount.balance += baseAmount;
        counterAccount.balance -= counterAmount;
        exchangeResult.ok = true;
        exchangeResult.counterAmount = counterAmount;
      } else {
        //could not transfer to clients' counter account, return base amount to client
        await transfer(baseAccount.id, clientBaseAccountId, baseAmount);
        exchangeResult.obs = "Could not transfer to clients' account";
      }
    } else {
      //could not withdraw from clients' account
      exchangeResult.obs = "Could not withdraw from clients' account";
    }
  } else {
    //not enough funds on internal counter account
    exchangeResult.obs = "Not enough funds on counter currency account";
  }

  //log the transaction and return it
  log.push(exchangeResult);

  return exchangeResult;
}

// internal - call transfer service to execute transfer between accounts
async function transfer(fromAccountId, toAccountId, amount) {
  const min = 200;
  const max = 400;
  return new Promise((resolve) =>
    setTimeout(() => resolve(true), Math.random() * (max - min + 1) + min)
  );
}

function findAccountByCurrency(currency) {
  for (let account of accounts) {
    if (account.currency == currency) {
      return account;
    }
  }

  return null;
}

function findAccountById(id) {
  for (let account of accounts) {
    if (account.id == id) {
      return account;
    }
  }

  return null;
}
