import * as server from "server";
import fs from 'fs';

var current_job = {};
var current_answers = {};
const PORT = 3030;
const LOGFILE = "logs/mining.log";

function current_height() {
  if ("block_height" in current_job) {
    return current_job.block_height
  }
}

function get_job(ctx) {
    return JSON.stringify(current_job);
}

function post_answer(ctx) {
  // miner_id has to be 4-byte hex string
  var miner_id = "miner-id" in ctx["headers"] ? ctx["headers"]["miner-id"] : null;
  if (!(/^([a-z0-9-]){1,}$/.test(miner_id))) {
    miner_id = "2vxsx-fae"; // anonymous principal id
  }
  let answer = ctx.data;
  if ("block_height" in answer && "nonce" in answer && answer.block_height == current_height() && miner_id && !(miner_id in current_answers)) {
    current_answers[miner_id] = answer.nonce;
  }
  return "";
}

export function start_server() {
  const { get, post } = server.router;
  // Launch server
  server.default(
    {
      port: PORT,
      security: { csrf: false },
      parser: { json: { limit: "1kb" } },
    },
    [get("/job", get_job), post("/answer", post_answer)],
  );
  return PORT;
}

export function new_job(job) {
  let line = JSON.stringify(job) + "\n";
  fs.appendFileSync(LOGFILE, line, "utf8");
  job["submitted"] = false;
  current_job = job;
  current_answers = {};
}

export function get_answers(height: number) {
  if (height == current_height()) {
    return Object.values(current_answers);
  } else {
    return [];
  }
}

export function is_submitted(height: number) {
  if (current_height() == height) {
    return current_job["submitted"] == true;
  }
}

export function mark_submitted(height: number) {
  if (current_height() == height) {
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
