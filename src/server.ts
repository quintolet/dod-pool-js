import * as bitcoin from "bitcoinjs-lib";
import { reverseBuffer } from "bitcoinjs-lib/src/bufferutils";
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

var current_job = {};
var total_contributions = {};
var current_contributions = {};
var current_answers = {};
var current_answer = null;
var log_rounds = 0;

function currentHeight() {
  if ("block_height" in current_job) {
    return current_job.block_height;
  }
}

function getJob(ctx) {
  return JSON.stringify(current_job);
}

function postAnswer(ctx) {
  // miner_id has to be 4-byte hex string
  var miner_id =
    "miner-id" in ctx["headers"] ? ctx["headers"]["miner-id"] : null;
  if (!/^([a-z0-9-]){1,}$/.test(miner_id)) {
    miner_id = "2vxsx-fae"; // anonymous principal id
  }
  let answer = ctx.data;
  if (
    "block_height" in answer &&
    "nonce" in answer &&
    miner_id &&
    answer.block_height == currentHeight()
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
    let contribution = processEvent(obj);
    if (contribution == 1) {
      current_answer = obj.nonce;
    }
    return "{contribution: " + contribution + "}";
  }
}

export function startServer() {
  let onDeath = require("death")({ SIGINT: true });
  onDeath(function (signal, err) {
    logContributions();
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
    [get("/job", getJob), post("/answer", postAnswer)],
  );
  return PORT;
}

export function newJob(job) {
  logContributions();
  if (log_rounds >= LOGFILE_ROUNDS_LIMIT) {
    rotateLogs();
    log_rounds = 0;
  }
  let line = JSON.stringify(job) + "\n";
  fs.appendFileSync(LOGFILE, line, "utf-8");
  log_rounds += 1;
  job["submitted"] = false;
  processEvent(job);
}

export function getAnswer(height: number) {
  if (height == currentHeight() && current_answer) {
    return [current_answer];
  } else {
    return [];
  }
}

export function isSubmitted(height: number) {
  if (currentHeight() == height) {
    return current_job["submitted"] == true;
  }
}

export function markSubmitted(height: number) {
  if (currentHeight() == height) {
    current_job["submitted"] = true;
  }
}

export async function loadLogs() {
  if (fs.existsSync(LOGFILE)) {
    const rl = readline.createInterface({
      input: fs.createReadStream(LOGFILE),
    });

    for await (const line of rl) {
      const obj = JSON.parse(line);
      if (obj) {
        if ("buffer" in obj && "block_height" in obj) {
          log_rounds += 1;
        }
        processEvent(obj);
      }
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
      break;
    }
  }
}

function logContributions() {
  for (var miner_id in current_answers) {
    for (var i in current_answers[miner_id]) {
      let answer = current_answers[miner_id][i];
      let line = JSON.stringify(answer) + "\n";
      fs.appendFileSync(LOGFILE, line, "utf-8");
    }
  }
}

function processEvent(obj) {
  if ("buffer" in obj) {
    // Add current_contributions to total_contributions
    for (var miner_id in current_contributions) {
      let contribution =
        miner_id in total_contributions ? total_contributions[miner_id] : 0;
      total_contributions[miner_id] =
        contribution +
        current_contributions[miner_id].reduce((x, y) => x + y, 0);
    }
    // Reset current_contributions and current_answers
    current_contributions = {};
    current_answers = {};
    current_answer = null;
    current_job = obj;
  } else if ("nonce" in obj) {
    // Compute and update miner contribution for current round (keep the max)
    let miner_id = obj["miner_id"];
    let nonce = obj["nonce"];
    let contribution = estimateContribution(current_job, obj.nonce);
    let contributions =
      miner_id in current_contributions ? current_contributions[miner_id] : [];
    let answers = miner_id in current_answers ? current_answers[miner_id] : [];
    if (contribution > 0) {
      if (!answers.find((obj) => obj["nonce"] == nonce)) {
        contributions.push(contribution);
        if (contributions.length > 15) {
          contributions = contributions.slice(1);
        }
        answers.push(obj);
        if (answers.length > 15) {
          answers = answers.slice(1);
        }
      }
      current_contributions[miner_id] = contributions;
      current_answers[miner_id] = answers;
    }
    return contribution;
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
