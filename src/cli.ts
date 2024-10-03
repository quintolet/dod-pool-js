import inquirer from 'inquirer';
import { password, input } from '@inquirer/prompts';
import { createAccountBatch, createCredential, loadAccountBatch, loadCredential, zip } from './utils/wallets';
import { loadWif } from './miner/storage';
import { credentialFolder } from './utils/constant';
import fs from 'fs';
import loading from 'loading-cli';
import { SiwbConnector } from './miner/siwbConnection';
import { init, mine, register } from './miner/runner';
import Decimal from 'decimal.js';

// import * as cmd from './cmd/index';
(async function () {
  const fileExist = fs.existsSync(credentialFolder + 'cred.txt');
  const jsonExist = fs.existsSync(credentialFolder + 'cred.json');

  if (!fileExist || !jsonExist) {
    //cmd.stop();
    const answers = await inquirer.prompt([
      {
        name: 'wallet',
        message: `No existing credentials found, creating a new?`,
        type: 'list',
        choices: ['Y', 'N'],
      },
    ]);
    if (answers.wallet === 'Y') {
      createCredential('cred');
      const str = loadCredential('cred');
      console.log('Seedphrase is created \n');
      console.log(str);
      console.log('\n');
      console.log('1 Wallet are created \n');
      createAccountBatch(str, 1, 'cred');
      console.log('./credentials/cred.json' + '\n');
      const answers2 = await inquirer.prompt([
        {
          name: 'zip',
          message: `Do you want to zip the credentials?`,
          type: 'list',
          choices: ['Y', 'N'],
        },
      ]);

      if (answers2.zip === 'Y') {
        const answer = await password({ message: 'Enter your password' });
        const zipFile = await zip(`cred`, answer, false, false);
        console.log(`zippedFile: ${zipFile} \n`);
        console.log('Continue... \n');
      } else {
        console.log('Continue... \n');
      }
    } else {
      console.log('Continue... \n');
    }
  } else {
    console.log('Continue... \n');
  }

  const answers3 = await inquirer.prompt([
    {
      name: 'start',
      message: `We will start minging, confirm??`,
      type: 'list',
      choices: ['Y', 'N'],
    },
  ]);

  if (answers3.start === 'Y') {
    // clear console
    const answerTCyclesPrice = await input({ message: 'Set your Cycles Price in TCycles' });

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

    load.color = 'blue';
    load.text = ' Registering';

    await register(delegation, pl.address, pl.pubkey);

    load.color = 'green';
    load.text = ' Registered';
    load.stop();

    await mine(delegation, pl.address, pl.pubkey, pl.output, pl.signer, new Decimal(answerTCyclesPrice).mul(1_000_000_000_000).toString(), load);
  } else {
    console.clear();
    console.log('Bye!');
  }
})();
