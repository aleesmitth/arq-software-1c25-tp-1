import { nanoid } from "nanoid";
import dotenv from 'dotenv';
import { createClient } from 'redis';
import { Console } from "console";
import StatsD from 'hot-shots';

dotenv.config();

const statsd = new StatsD({
  host: 'graphite',
  port: 8125,
  prefix: 'exchange-service.',
});

const client = createClient({
  username: 'mario',
  password: process.env.REDIS_PASSWORD, //'TParqsoft1!',
  socket: {
    host: 'redis-17076.c57.us-east-1-4.ec2.redns.redis-cloud.com',
    port: 17076,
  }
});
client.on('error', err => console.error('Redis Client Error:', err));
await client.connect();


//returns all internal accounts
export async function getAccounts() {
  const key = "accounts";

  try {
    const dataString = await client.get(key);
    return JSON.parse(dataString);

  } catch (err) {
    console.error(`Error loading data from Redis with key "${key}":`, err);
  }
}

//sets balance for an account TODO!
export async function setAccountBalance(accountId, balance) {
  let accounts = await getAccounts();
  console.log(accounts)
  const account = accounts.find(acc => acc.id == accountId);
  if (account) {
    account.balance = balance;
    const dataString = JSON.stringify(accounts);
    await client.set("accounts", dataString); // Store string in Redis

  }
  else{
    console.error(`Error looking for account of ID "${accountId}":`);
  }
}

//returns all current exchange rates
export async function getRates() {
  const key = "rates";

  try {
    const dataString = await client.get(key);
    return JSON.parse(dataString);
  } catch (err) {
    console.error(`Error loading data from Redis with key "${key}":`, err);
  }
}

//returns the whole transaction log
export async function getLog() {
  const key = "logs";

  try {
    const dataString = await client.get(key);
    return JSON.parse(dataString);
  } catch (err) {
    console.error(`Error loading data from Redis with key "${key}":`, err);
  }
}

//sets the exchange rate for a given pair of currencies, and the reciprocal rate as well
export async function setRate(rateRequest) {
  const { baseCurrency, counterCurrency, rate } = rateRequest;
  try {
    let rates = await getRates();
    if (!rates[baseCurrency]) {
      rates[baseCurrency] = {};
    }
    if (!rates[counterCurrency]) {
      rates[counterCurrency] = {};
    }
    rates[baseCurrency][counterCurrency] = rate;
    rates[counterCurrency][baseCurrency] = Number((1 / rate).toFixed(5));
    const dataString = JSON.stringify(rates);
    await client.set("rates", dataString); // Store string in Redis
  } catch (err) {
    console.error(`Error saving data to Redis with key "${"rates"}":`, err);
  }
}

export async function putLog(log) {
  try{
    const dataString = JSON.stringify(log);
    await client.set("logs", dataString); // Store string in Redis
  } catch (err) {
    console.error(`Error saving data to Redis with key "${"logs"}":`, err);
  }
}


//executes an exchange operation
export async function exchange(exchangeRequest) {
  const {
    baseCurrency,
    counterCurrency,
    baseAccountId,
    counterAccountId,
    baseAmount,
  } = exchangeRequest;

  let rates = await getRates();
  let accounts = await getAccounts();
  const exchangeRate = rates[baseCurrency][counterCurrency];
  console.log("exchange rate: ", exchangeRate);

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

  if(!exchangeRate){
    exchangeResult.obs = "Error, exchange rate unknown";
    return exchangeResult;
  }
  const counterAmount = baseAmount * exchangeRate;


  let baseAccount = accounts.find(acc => acc.id == baseAccountId);
  let counterAccount = accounts.find(acc => acc.id == counterAccountId);
  if (!baseAccount||!counterAccount){
    exchangeResult.obs = "Error withdrawing one of the accounts";
    return exchangeResult;
  }
  if (baseAccount.currency!=baseCurrency || counterAccount.currency!=counterCurrency){
    //console.log(baseAccount.currency, baseCurrency);
    exchangeResult.obs = "Error, the currency on the base is not the account in the database";
    return exchangeResult;
  }
  // console.log(baseAccount, counterAccount);
  if (counterAccount.balance < counterAmount) {
    exchangeResult.obs = "Error, not enough amount on counter account";
    return exchangeResult;
  }

  if (counterAccount.balance >= counterAmount) {
    //try to transfer from clients' base account
    if (await transfer(baseAccountId, baseAccount.id, baseAmount)) {
      //try to transfer to clients' counter account
      if (
        await transfer(counterAccount.id, counterAccountId, counterAmount)
      ) {
        //all good, update balances
        baseAccount.balance += baseAmount;
        counterAccount.balance -= counterAmount;
        const dataString = JSON.stringify(accounts);
        await client.set("accounts", dataString); // Store string in Redis

        exchangeResult.ok = true;
        exchangeResult.counterAmount = counterAmount;

        statsd.increment(`volume.total.${baseCurrency}`, Math.round(baseAmount * 100));
        statsd.increment(`volume.net.${baseCurrency}`, Math.round(-baseAmount * 100));

        statsd.increment(`volume.total.${counterCurrency}`, Math.round(counterAmount * 100));
        statsd.increment(`volume.net.${counterCurrency}`, Math.round(counterAmount * 100));
      } else {
        //could not transfer to clients' counter account, return base amount to client
        await transfer(baseAccount.id, baseAccountId, baseAmount);
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
  putLog(exchangeResult);
  return exchangeResult;



  /*
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

  */

}

// internal - call transfer service to execute transfer between accounts
async function transfer(fromAccountId, toAccountId, amount) {
  const min = 200;
  const max = 400;
  return new Promise((resolve) =>
    setTimeout(() => resolve(true), Math.random() * (max - min + 1) + min)
  );
}
