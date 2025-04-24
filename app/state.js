import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

let accounts = null;
let rates = null;
let log = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACCOUNTS = "accounts";
const RATES = "rates";
const LOG = "log";

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

export async function init() {
  accounts = await load(ACCOUNTS);
  rates = await load(RATES);
  log = await load(LOG);

  scheduleSave(accounts, ACCOUNTS, 1000);
  scheduleSave(rates, RATES, 5000);
  scheduleSave(log, LOG, 1000);
}

export function getAccounts() {
  return accounts;
}

export function getRates() {
  return rates;
}

export function getLog() {
  return log;
}

//Guarda en REDIS
async function save(data, key) {
  try {
    const dataString = JSON.stringify(data); // Convert JSON to string
    await client.set(key, dataString); // Store string in Redis
  } catch (err) {
    console.error(`Error saving data to Redis with key "${key}":`, err);
  }
}

//Carga desde REDIS
async function load(key) {
  try {
    const dataString = await client.get(key); // Retrieve string from Redis
    if (dataString) {
      return JSON.parse(dataString); // Convert string back to JSON
    } else {
      console.error(`No data found in Redis for key "${key}"`);
    }
  } catch (err) {
    console.error(`Error loading data from Redis with key "${key}":`, err);
  }
}

function scheduleSave(data, key, period) {
  setInterval(async () => {
    await save(data, key);
  }, period);
}


/*
//Carga desde ARCHIVO
async function load(fileName) {
  const filePath = path.join(__dirname, fileName);

  try {
    await fs.promises.access(filePath);
    const raw = await fs.promises.readFile(filePath, "utf8");
    
    return JSON.parse(raw);
  } catch (err) {
    if (err.code == "ENOENT") {
      console.error(`${filePath} not found`);
    } else {
      console.error(`Error loading ${filePath}:`, err);
    }
  }
}


//Guarda ARCHIVO
async function save(data, fileName) {
  const filePath = path.join(__dirname, fileName);
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
  }
}



*/
