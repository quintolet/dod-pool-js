import inquirer from 'inquirer';
import { password, input } from '@inquirer/prompts';
import { createAccountBatch, createCredential, loadAccountBatch, loadCredential, zip } from './utils/wallets';
import { loadWif } from './miner/storage';
import { credentialFolder } from './utils/constant';
import fs from 'fs';
import loading from 'loading-cli';
import { SiwbConnector } from './miner/siwbConnection';
import { init, mine, register } from './miner/benchmark_runner';
import Decimal from 'decimal.js';
import { exit } from 'process';

// import * as cmd from './cmd/index';
(async function () {
    // clear console
    const answerTCyclesPrice = 999;

    console.log({ answerTCyclesPrice });

    console.clear();
    const { WIF } = (await loadAccountBatch('cred', false))[0];
    const pl = await init(WIF);

    const load = loading('Connecting Network!').start();

    const id = await SiwbConnector.connect(pl.signer, pl.address);

    // connected

    load.color = 'green';
    load.text = ' Network connected';

    const delegation = id.getIdentity();

    await mine(delegation, pl.address, pl.pubkey, pl.output, pl.signer, new Decimal(answerTCyclesPrice).mul(1_000_000_000_000).toString(), load);
  }
)();
