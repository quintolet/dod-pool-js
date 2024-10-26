import * as server from "server";
import fs from 'fs';

var current_job = {};
var current_answers = {};
const PORT = 3030;
const LOGFILE = "logs/mining.log";

function currentHeight() {
  if ("block_height" in current_job) {
    return current_job.block_height
  }
}

function getJob(ctx) {
    return JSON.stringify(current_job);
}

function postAnswer(ctx) {
  // miner_id has to be 4-byte hex string
  var miner_id = "miner-id" in ctx["headers"] ? ctx["headers"]["miner-id"] : null;
  if (!(/^([a-z0-9-]){1,}$/.test(miner_id))) {
    miner_id = "2vxsx-fae"; // anonymous principal id
  }
  let answer = ctx.data;
  if ("block_height" in answer && "nonce" in answer && answer.block_height == currentHeight() && miner_id && !(miner_id in current_answers)) {
    current_answers[miner_id] = answer.nonce;
  }
  return "";
}

export function startServer() {
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
  let line = JSON.stringify(job) + "\n";
  fs.appendFileSync(LOGFILE, line, "utf8");
  job["submitted"] = false;
  current_job = job;
  current_answers = {};
}

export function getAnswers(height: number) {
  if (height == currentHeight()) {
    return Object.values(current_answers);
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
    for (var miner_id in current_answers) {
      let line = JSON.stringify({
        time: Date.now(),
        block_height: height,
        miner_id,
        nonce: current_answers[miner_id],
      }) + "\n";
      fs.appendFileSync(LOGFILE, line, "utf8");
    }
    current_job["submitted"] = true;
  }
}
