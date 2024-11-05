import { Principal } from "@dfinity/principal";
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
const ANONYMOUS_ID = "2vxsx-fae";
const MAX_PAST_HASHRATES = 60;

let pool_principal;
let pool_address = "";
let dodActor: ActorSubclass<dodService>;
let mined_blocks_since_last_distribution = [];

function new_state() {
  return {
    current_job: {},
    accumulated_contributions: {},
    current_contributions: {},
    current_answers: {},
    current_answer: null,
    past_hashrates: [],
    log_rounds: 0,
    starting_height: 0,
    distributed: {},
  };
}

var server_state = new_state();

function currentHeight(state) {
  if ("block_height" in state.current_job) {
    return state.current_job.block_height;
  }
}

const getJob = (state) => (ctx) => {
  return server.reply.json(state.current_job);
};

const postAnswer = (state) => (ctx) => {
  // miner_id has to be 4-byte hex string
  var miner_id =
    "miner-id" in ctx.headers
      ? ctx.headers["miner-id"]
      : "minder-id" in ctx.data
        ? ctx.data["miner-id"]
        : null;
  try {
    miner_id = Principal.fromText(miner_id).toString();
  } catch (_) {
    return server.reply.json({
      error: `The submitted miner-id '${miner_id}' is not a valid principal id.`,
    });
  }
  let answer = ctx.data;
  if (
    "block_height" in answer &&
    "nonce" in answer &&
    miner_id &&
    answer.block_height == currentHeight(state)
  ) {
    if (isSubmitted(answer.block_height)) {
      return server.reply.json({ contribution: 0 });
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
    return server.reply.json({ contribution });
  }
};

const getStats = (state) => async (ctx) => {
  let block_height = currentHeight(state);
  if (!block_height) {
    return {};
  }
  let rounds_until_next_distribution =
    LOGFILE_ROUNDS_LIMIT > state.log_rounds
      ? LOGFILE_ROUNDS_LIMIT - state.log_rounds
      : 0;
  let hashrate = state.past_hashrates.reduce((x, y) => x + y, 0n);
  if (state.past_hashrates.length > 0) {
    hashrate /= BigInt(state.past_hashrates.length);
  }
  let pool = {
    principal: pool_principal.toString(),
    address: pool_address,
    estimated_hashrate: hashrate,
  };
  let undistributed_cycle_rewards = sumBlocksRewards(
    mined_blocks_since_last_distribution,
  );
  let rewards = {
    rounds_until_next_distribution,
    mined_blocks_since_last_distribution,
    undistributed_cycle_rewards,
    accumulated_contributions: state.accumulated_contributions,
  };
  let current_round = {
    block_height,
    contributions: state.current_contributions,
  };
  let stats = {
    pool,
    rewards,
    current_round,
  };
  return server.reply
    .type("application/json; charset=utf-8")
    .send(
      JSON.stringify(stats, (key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
};

export function startServer() {
  let state = server_state;
  let onDeath = require("death")({ SIGINT: true });
  onDeath(function (signal, err) {
    logContributions(state);
    process.exit(0);
  });
  const { get, post, error } = server.router;
  // Launch server
  server.default(
    {
      port: PORT,
      security: { csrf: false },
      parser: { json: { limit: "1kb" } },
    },
    [
      get("/job", getJob(state)),
      get("/stats", getStats(state)),
      post("/answer", postAnswer(state)),
      get("/favicoon.ico", (_) => 404),
      (_) => 404,
    ],
  );
  return PORT;
}

export function setActor(actor, address, principal) {
  pool_principal = principal;
  pool_address = address;
  dodActor = actor;
}

export function newJob(job) {
  let state = server_state;
  logContributions(state);
  if (state.log_rounds >= LOGFILE_ROUNDS_LIMIT) {
    rotateLogs();
    mined_blocks_since_last_distribution = [];
    state.log_rounds = 0;
    state.accumulated_contributions = {};
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
        processEvent({ commit: true }, state);
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
    // Add current_contributions to accumulated_contributions
    for (var miner_id in state.current_contributions) {
      let contribution =
        miner_id in state.accumulated_contributions
          ? state.accumulated_contributions[miner_id]
          : 0;
      state.accumulated_contributions[miner_id] =
        contribution +
        state.current_contributions[miner_id].reduce((x, y) => x + y, 0);
    }
    let hashrate = estimateHashRate(state);
    if (hashrate != 0n) {
      state.past_hashrates.push(hashrate);
    }
    if (state.past_hashrates.length > MAX_PAST_HASHRATES) {
      state.past_hashrates = state.past_hashrates.slice(1);
    }
    // Reset current_contributions and current_answers
    state.current_contributions = {};
    state.current_answers = {};
    state.current_answer = null;
    setTimeout(async () => {
      mined_blocks_since_last_distribution = await getMinedBlocks(
        state.starting_height,
        currentHeight(state),
      );
    }, 500);
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
    state.distributed[obj.miner_id] = BigInt(obj.distributed);
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

export async function distributeRewards(logfile, verbose = false) {
  let state = new_state();
  await readLogsFrom(logfile, state);
  processEvent({ commit: true }, state);
  let rewards: bigint = await totalRewardsInBlockRange(
    state.starting_height,
    currentHeight(state),
  );
  let distributed: { [key: string]: bigint } = state.distributed;
  let contributions: { [key: string]: number } =
    state.accumulated_contributions;
  let miners = Object.keys(contributions);
  let total_contributions = Object.values(contributions).reduce(
    (x, y) => x + y,
    0,
  );
  if (total_contributions <= 0) {
    return [total_contributions, rewards, 0, 0];
  }
  let shares = Object.values(contributions).map((x) => x / total_contributions);
  let to_distribute = rewards - (rewards * MININGN_POOL_REWARDS_SHARE) / 100n;
  let previously_distributed = 0n;
  let newly_distributed = 0n;
  let args = [];
  for (var i = 0; i < miners.length; i++) {
    let miner = miners[i];
    if (verbose) {
      console.log(`miner = ${miner} share = ${100 * shares[i]}%`);
    }
    let share = BigInt(Math.floor(shares[i] * 1_000_000_000));
    let cycles = (to_distribute * share) / 1_000_000_000n;
    if (miner in distributed && cycles <= distributed[miner]) {
      cycles -= distributed[miner];
      previously_distributed += distributed[miner];
    }
    let miner_exists = await doesUserExist(miner);
    if (!miner_exists) {
      console.log(
        `Unable to distribute rewards, non-existent miner account ${miner}`,
      );
    } else if (cycles >= MIN_CYCLES_DISTRIBUTION && miner != ANONYMOUS_ID) {
      try {
        let pid = Principal.fromText(miner);
        newly_distributed += cycles;
        args.push([Principal.fromText(miner), cycles]);
      } catch (_) {
        console.log(
          "Invalid principal:",
          miner,
          " unable to distribute cycles ",
          cycles,
        );
      }
    }
  }
  try {
    let result = await dodActor.inner_transfer_cycles(args);
    if (result && "Ok" in result) {
      for (var i = 0; i < args.length; i++) {
        let miner_id = args[i][0].toString();
        let distributed = args[i][1].toString();
        let line = JSON.stringify({ miner_id, distributed }) + "\n";
        fs.appendFileSync(logfile, line, "utf-8");
      }
    } else {
      console.log("Error calling inner_transfer_cycles:", result);
    }
  } catch (err) {
    console.log("Error calling inner_transfer_cycles:", err);
  }
  return [
    total_contributions,
    rewards,
    previously_distributed,
    newly_distributed,
  ];
}

export async function totalRewardsInBlockRange(starting_height, ending_height) {
  let blocks = await getMinedBlocks(starting_height, ending_height);
  return sumBlocksRewards(blocks);
}

function sumBlocksRewards(blocks) {
  let total = 0n;
  for (var i = 0; i < blocks.length; i++) {
    let block = blocks[i];
    if (block.winner) {
      total += block.cycles_price;
    }
  }
  return total;
}

async function getMinedBlocks(starting_height, ending_height) {
  if (dodActor) {
    try {
      return await dodActor.get_mining_history_for_miners(
        pool_address,
        starting_height,
        ending_height + 1,
      );
    } catch (err) {
      console.log(err);
    }
  }
  return [];
}

async function doesUserExist(miner_id) {
  let miner_exists = false;
  try {
    let result = await dodActor.get_user_detail_indexer(
      Principal.fromText(miner_id),
    );
    miner_exists = result.length > 0;
  } catch (err) {
    console.log(err);
  }
  return miner_exists;
}

function estimateHashRate(state) {
  let job = state.current_job;
  if (Object.keys(job).length == 0) {
    return 0;
  }
  let contributions: number[][] = Object.values(state.current_contributions);
  let post = Number.parseInt(job.post_hex, 16);
  let base = 2n ** (4n * BigInt(job.pre)) * (1n + BigInt(post));
  let total_contribution = contributions
    .map((arr) => arr.reduce((x, y) => x + y, 0))
    .reduce((x, y) => x + y, 0);
  return (base * BigInt(Math.floor(total_contribution * 1000))) / 1000n / 3000n;
}
