# A DOD miner pool

A DOD mining pool based off the [miner-js] implementation.

*Still a work-in-progress.*

- [x] Run HTTP server to distribute jobs and collect answers.
- [x] Bid cycles price automatically.
- [x] Track worker contributions.
  - [x] Keep logs
  - [x] Verify worker contribution
  - [x] Accounting
- [x] Show a stats page.
- [x] Distribute mining rewards.

**Quick Start**

```
pnpm install && pnpm run miner
```

By default the pool will listen on port 3030.

Workers (e.g. those who run [dod-worker-rs]) can connect by specifying the pool's IP address and port number.

**Bidding strategy**

DOD requires all miners to give a cycles price when submitting work, and only the one with lowest bid will win.

This mining pool uses the following strategy:

- Take the median of the none-zero winning bids in the last 20 blocks.
- Skip the current round if the median is too small (e.g. < 0.1 TC).
- Otherwise, add in some random variance when making a bid.

Ideas and PRs of other strategies are welcome!

**Mining contribution**

Miners can submit solutions that give partial match, which can increase the miner's overall contribution.
The better match a miner can find, the greater the contribution.
The mining contribution of each solution ranges from 0 to 1, where 1 corresponds to a full solution.

Mining contributions are accumulated for each miner.
For each round, the pool will take only the top 15 submissions from a miner and add them to its overall contribution.

Note that once a full solution is found for a given round, additional submissions will not be credited.

**Reward distribution**

Mining rewards (in terms of cycles) are typically distributed when the current log file (`logs/events.log`) is rotated, which by default is every 1000 rounds, or every 16.6 hours.
When a rotation happens, the current log file is archived and becomes the next numbered file as in `events.log_000001`, `events_log_000002`, and so on.
Once a new archived log is created, rewards accumulated during the logged blocks will be distributed to miners proportional to their contributions logged in the same file.

The following settings can be customized by editing `src/server.ts`:

1. `MININGN_POOL_REWARDS_SHARE` is set to 2%, which is the mining fee that goes to the operator.
2. `LOGFILE_ROUNDS_LIMIT` is set to 1000, which is the number rounds between log rotations.
3. `MIN_CYCLES_DISTRIBUTION` is set to `1_000_000`, which is the minimum cycles to distributed to a miner. Miners who earn less than that during a period do not get any rewards.

Distribution can also be triggered manually should automatic distribution failed:

```
pnpm run reward [logfile]
```

It also displays a bit more information about the total reward in the logged period, and which miner gets what percentage.

Please note that the command should only be run on archived logs, not the current log.
Successful reward distributions are also appended to the same archived log file.
This prevents rewards from being distributed twice, so it is safe to run the above command more than once.

**Endpoints**

A worker fetches the current job by `GET /job`.

Sample response:

```
{
  "buffer": "...",                  // transaction object in hex string.
  "hex_start": 101,                 // starting index of the 16-byte nonce to be filled in the buffer
  "remote_hash": "...",             // target sha-256 hash that is expected to match
  "pre": 8,                         // number of hex digit to prefix match in the remote_hash
  "post_hex": "5",                  // hex digit to match after the prefix
  "next_block_time": 1729664582963, // next block time (UNIX time in milliseconds)
  "block_height": 15871,            // block height
  "submitted": false,               // whether a matching answer has already been submitted
}
```

If a job is already marked as "submitted", the worker should wait until the `next_block_time` to get a new job.

A worker submits answers by `POST /answer`.

Required headers:

* `content-type: application-json`.
* `miner-id: XXXXX`, where `XXXXX` should be the miner's principal that receives the rewards.

Required body in JSON:

```
{
  "block_height": 121,              // job block_height
  "nonce": "...",                   // 16-byte nonce in hex string.
}
```

Sample response:

```
{
  "contribution": 0.000244140625    // contribution of the submission
}
```

One can also get pool statistics by `GET /stats`.

Sample response:

```
{
  "pool": {
    "principal": "...",
    "address": "...",
    "estimated_hashrate": "1182781307",
    "distribution_interval": 1000,
    "mining_fee_percent": 2
  },
  "rewards": {
    "rounds_until_next_distribution": 690,
    "mined_blocks_since_last_distribution": [ ... ],
    "undistributed_cycle_rewards": "96664521359",
    "accumulated_contributions": { .. },
  "current_round": {
    "block_height": 36047,
    "contributions": { .. }
  }
}
```

[miner-js]: https://github.com/DOD-Blockchain/miner-js
[dod-worker-rs]: https://github.com/quintolet/dod-worker-rs
