import inquirer from "inquirer";
import config from "./config/config";
import { idlFactory as dodIDL } from "./miner/idls/dod.idl";
import { _createActor } from "./miner/baseConnection";
import { _SERVICE as dodService } from "./miner/idls/dod";
import { password, input } from "@inquirer/prompts";
import {
  createAccountBatch,
  createCredential,
  loadAccountBatch,
  loadCredential,
  zip,
} from "./utils/wallets";
import { loadWif } from "./miner/storage";
import { credentialFolder } from "./utils/constant";
import fs from "fs";
import loading from "loading-cli";
import { SiwbConnector } from "./miner/siwbConnection";
import { init, mine, register } from "./miner/runner";
import Decimal from "decimal.js";
import { setActor, distributeRewards } from "./server";

const DOD_CANISTERID = config.dod_canister;

// import * as cmd from './cmd/index';
(async function () {
  console.log("\n");
  if (process.argv.length != 3) {
    console.log(`USAGE: pnpm run reward [event log file]\n`);
    process.exit(1);
  }

  const logfile = process.argv[2];
  if (!fs.existsSync(logfile)) {
    console.log(`file ${logfile} is not found\n`);
    process.exit(1);
  }

  const fileExist = fs.existsSync(credentialFolder + "cred.txt");
  const jsonExist = fs.existsSync(credentialFolder + "cred.json");

  if (!fileExist || !jsonExist) {
    console.log("No credentials found! Abort... \n");
    process.exit(1);
  }

  const answers3 = await inquirer.prompt([
    {
      name: "start",
      message: `We will start process ${logfile}, confirm??`,
      type: "list",
      choices: ["Y", "N"],
    },
  ]);

  if (answers3.start === "Y") {
    const { WIF } = (await loadAccountBatch("cred", false))[0];
    const pl = await init(WIF);

    let load = loading("Connecting Network!").start();

    const id = await SiwbConnector.connect(pl.signer, pl.address);

    // connected

    load.color = "green";
    load.text = " Network connected";

    const delegation = id.getIdentity();

    load.color = "blue";
    load.text = " Registering";

    await register(delegation, pl.address, pl.pubkey);

    load.color = "green";
    load.text = " Registered";
    load.stop();

    //await mine(delegation, pl.address, pl.pubkey, pl.output, pl.signer, load);
    const { actor } = await _createActor<dodService>(
      dodIDL,
      DOD_CANISTERID,
      delegation,
    );
    setActor(actor, pl.address);
    const [
      total_contributions,
      total_rewards,
      previously_distributed,
      newly_distributed,
    ] = await distributeRewards(logfile, true);
    // console.log(`   total contributions = ${total_contributions}`);
    console.log(`    total cycles mined = ${total_rewards}`);
    console.log(`cycles already awarded = ${previously_distributed}`);
    console.log(`  cycles newly awarded = ${newly_distributed}`);
  } else {
    console.log("Bye!");
  }
})();
