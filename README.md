# A DOD miner pool

A DOD mining pool based off the [miner-js] implementation.

*Still a work-in-progress.*

- [x] Run HTTP server to distribute jobs and collect answers.
- [x] Bid cycles price automatically.
- [x] Track worker contributions.
  - [x] Keep logs
  - [x] Verify worker contribution
  - [x] Accounting
- [ ] Show a stats page.
- [ ] Distribute mining rewards.

**Quick Start**

```
pnpm install && pnpm run miner
```

By default the pool will listen on port 3030.

Workers (e.g. those who run [dod-worker-rs]) can connect by specifying the pool's ip address and port number.

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

If the a job is already marked as "submitted", the worker should wait until the `next_block_time` to get a new job.

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

[miner-js]: https://github.com/DOD-Blockchain/miner-js
[dod-worker-rs]: https://github.com/quintolet/dod-worker-rs
