import * as bitcoin from "bitcoinjs-lib";
import { reverseBuffer } from "bitcoinjs-lib/src/bufferutils";
import { ActorSubclass } from "@dfinity/agent";
import { _SERVICE as dodService } from "./miner/idls/dod";
import * as server from "server";
import fs from "fs";
import readline from "readline";
import assert from "assert";

const PORT = 3030;
const LOGDIR = "./logs";
const LOGFILE_NAME = "events.log";
const LOGFILE = LOGDIR + "/" + LOGFILE_NAME;
const LOGFILE_ROUNDS_LIMIT = 1000;
const LOGFILE_INDEX_MAX_ZEROS = 6;
const MIN_CYCLES_DISTRIBUTION = 1_000_000n;
const MININGN_POOL_REWARDS_SHARE = 2n; // 2 percent

let pool_address = "";
let dodActor: ActorSubclass<dodService>;

var server_state = {
  current_job: {},
  total_contributions: {},
  current_contributions: {},
  distributed: {},
  current_answers: {},
  current_answer: null,
  log_rounds: 0,
  starting_height: 0,
};

function currentHeight(state) {
  if ("block_height" in state.current_job) {
    return state.current_job.block_height;
  }
}

const getJob = (state) => (ctx) => {
  return JSON.stringify(state.current_job);
};

const postAnswer = (state) => (ctx) => {
  // miner_id has to be 4-byte hex string
  var miner_id = "miner-id" in ctx.headers ? ctx.headers["miner-id"] : null;
  if (!/^([a-z0-9-]){1,}$/.test(miner_id)) {
    miner_id = "2vxsx-fae"; // anonymous principal id
  }
  let answer = ctx.data;
  if (
    "block_height" in answer &&
    "nonce" in answer &&
    miner_id &&
    answer.block_height == currentHeight(state)
  ) {
    if (isSubmitted(answer.block_height)) {
      return "{contribution: 0}";
    }
    let obj = {
      time: Date.now(),
      block_height: answer.block_height,
      miner_id,
      nonce: answer.nonce,
    };
    let contribution = processEvent(obj, state);
    if (contribution == 1) {
      state.current_answer = obj.nonce;
    }
    return "{contribution: " + contribution + "}";
  }
};

export function startServer() {
  let state = server_state;
  let onDeath = require("death")({ SIGINT: true });
  onDeath(function (signal, err) {
    logContributions(state);
    process.exit(0);
  });
  const { get, post } = server.router;
  // Launch server
  server.default(
    {
      port: PORT,
      security: { csrf: false },
      parser: { json: { limit: "1kb" } },
    },
    [get("/job", getJob(state)), post("/answer", postAnswer(state))],
  );
  return PORT;
}

export function setActor(actor, address) {
  pool_address = address;
  dodActor = actor;
}

export function newJob(job) {
  let state = server_state;
  logContributions(state);
  if (state.log_rounds >= LOGFILE_ROUNDS_LIMIT) {
    rotateLogs();
    state.log_rounds = 0;
  }
  let line = JSON.stringify(job) + "\n";
  fs.appendFileSync(LOGFILE, line, "utf-8");
  state.log_rounds += 1;
  job.submitted = false;
  processEvent({ commit: true }, state);
  processEvent(job, state);
}

export function getAnswer(height: number) {
  let state = server_state;
  if (height == currentHeight(state) && state.current_answer) {
    return [state.current_answer];
  } else {
    return [];
  }
}

export function isSubmitted(height: number) {
  let state = server_state;
  if (currentHeight(state) == height) {
    return state.current_job["submitted"] == true;
  }
}

export function markSubmitted(height: number) {
  let state = server_state;
  if (currentHeight(state) == height) {
    state.current_job["submitted"] = true;
  }
}

export async function loadLogs() {
  if (fs.existsSync(LOGFILE)) {
    await readLogsFrom(LOGFILE, server_state);
    processEvent({ commit: true }, server_state);
  }
}

async function readLogsFrom(filename, state) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filename),
  });

  for await (const line of rl) {
    const obj = JSON.parse(line);
    if (obj) {
      if ("buffer" in obj && "block_height" in obj) {
        if (state.starting_height == 0) {
          state.starting_height = obj.block_height;
        }
        state.log_rounds += 1;
      }
      processEvent(obj, state);
    }
  }
}

function rotateLogs() {
  let files = fs.readdirSync("./logs");
  let logfiles = files.filter((name) => name.startsWith(LOGFILE_NAME));
  logfiles = logfiles.sort();
  let maxidx = 0;
  let i = logfiles.length;
  while (i > 0) {
    i -= 1;
    let lastfile = logfiles.pop();
    let match = lastfile.match(/^.*_([0-9]*)$/);
    if (match && match[1] && Number.parseInt(match[1])) {
      maxidx = Number.parseInt(match[1]);
      break;
    }
  }
  while (true) {
    let nextidx = "0".repeat(LOGFILE_INDEX_MAX_ZEROS) + (maxidx + 1);
    nextidx = nextidx.substring(nextidx.length - LOGFILE_INDEX_MAX_ZEROS);
    let filename = LOGDIR + "/" + LOGFILE_NAME + "_" + nextidx;
    if (fs.existsSync(filename)) {
      maxidx += 1;
    } else {
      fs.renameSync(LOGFILE, filename);
      distributeRewards(filename);
      break;
    }
  }
}

function logContributions(state) {
  for (var miner_id in state.current_answers) {
    for (var i in state.current_answers[miner_id]) {
      let answer = state.current_answers[miner_id][i];
      let line = JSON.stringify(answer) + "\n";
      fs.appendFileSync(LOGFILE, line, "utf-8");
    }
  }
}

function processEvent(obj, state) {
  if ("commit" in obj) {
    // Add current_contributions to total_contributions
    for (var miner_id in state.current_contributions) {
      let contribution =
        miner_id in state.total_contributions
          ? state.total_contributions[miner_id]
          : 0;
      state.total_contributions[miner_id] =
        contribution +
        state.current_contributions[miner_id].reduce((x, y) => x + y, 0);
    }
    // Reset current_contributions and current_answers
    state.current_contributions = {};
    state.current_answers = {};
    state.current_answer = null;
  } else if ("buffer" in obj) {
    state.current_job = obj;
  } else if ("nonce" in obj) {
    // Compute and update miner contribution for current round (keep the max)
    let miner_id = obj.miner_id;
    let nonce = obj.nonce;
    let contribution = estimateContribution(state.current_job, obj.nonce);
    let contributions =
      miner_id in state.current_contributions
        ? state.current_contributions[miner_id]
        : [];
    let answers =
      miner_id in state.current_answers ? state.current_answers[miner_id] : [];
    if (contribution > 0) {
      if (!answers.find((obj) => obj.nonce == nonce)) {
        contributions.push(contribution);
        if (contributions.length > 15) {
          contributions = contributions.slice(1);
        }
        answers.push(obj);
        if (answers.length > 15) {
          answers = answers.slice(1);
        }
      }
      state.current_contributions[miner_id] = contributions;
      state.current_answers[miner_id] = answers;
    }
    return contribution;
  } else if ("distributed" in obj) {
    state.distributed[obj.miner_id] = obj.distributed;
  }
  return 0;
}

// Estimate the contribution of solving the hashing puzzle.
// Return a floating point number between 0 and 1.
export function estimateContribution(job, nonce: string) {
  let b = Buffer.from(job.buffer, "hex");
  let hex = Buffer.from(nonce, "hex");
  b.set(hex, job.hex_start);
  let hash = reverseBuffer(bitcoin.crypto.hash256(b)).toString("hex");
  let job_hash = job.remote_hash;
  let pre = job.pre;
  let matched = longestCommonPrefix([hash, job_hash]).length;
  if (matched == 0) {
    return 0;
  }
  if (matched > pre) {
    matched = pre;
  }
  let post = Number.parseInt(hash.substring(matched, matched + 1), 16);
  let job_post = Number.parseInt(job.post_hex, 16);
  let effort = 2n ** BigInt((pre - matched) * 4) * 1000n;
  if (matched == pre) {
    effort *= 2n * BigInt(job_post + 1);
    effort /= BigInt(Math.min(post, job_post) + 1);
  }
  return 2000 / Number(effort);
}

function longestCommonPrefix(strs) {
  let arr = strs.concat().sort();
  const a1 = arr[0];
  const a2 = arr[arr.length - 1];
  const length = a1.length;
  let i = 0;

  while (i < length && a1.charAt(i) == a2.charAt(i)) i++;
  return a1.substring(0, i);
}

async function distributeRewards(logfile) {
  let state = {
    current_job: {},
    total_contributions: {},
    current_contributions: {},
    current_answers: {},
    current_answer: null,
    log_rounds: 0,
    starting_height: 0,
    distributed: {},
  };
  await readLogsFrom(logfile, state);
  processEvent({ commit: true }, state);
  let rewards: bigint = await totalRewardsInBlockRange(
    state.starting_height,
    currentHeight(state),
  );
  let distributed: { [key: string]: bigint } = state.distributed;
  let contributions: { [key: string]: number } = state.total_contributions;
  let miners = Object.keys(contributions);
  let total = Object.values(contributions).reduce((x, y) => x + y, 0);
  if (total <= 0) {
    return;
  }
  let shares = Object.values(contributions).map((x) => x / total);
  let to_distribute = rewards - (rewards * MININGN_POOL_REWARDS_SHARE) / 100n;
  for (var i = 0; i < miners.length; i++) {
    let miner = miners[i];
    let share = BigInt(shares[i] * 1_000_000_000);
    let cycles = (to_distribute * share) / 1_000_000_000n;
    if (miner in distributed && cycles <= distributed[miner]) {
      cycles -= distributed[miner];
    }
    if (cycles >= MIN_CYCLES_DISTRIBUTION) {
      // TODO:
      // 1. distribution cycles to miner
      // 2. log successful distribution
    }
  }
}

export async function totalRewardsInBlockRange(starting_height, ending_height) {
  try {
    let blocks = await dodActor.get_mining_history_for_miners(
      pool_address,
      starting_height,
      ending_height + 1,
    );
    let total = 0n;
    for (var i = 0; i < blocks.length; i++) {
      let block = blocks[i];
      if (block.winner) {
        total += block.cycles_price;
      }
    }
    return total;
  } catch (err) {
    console.log(err);
    return 0n;
  }
}
