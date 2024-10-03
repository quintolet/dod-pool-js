// Use Jest to test
import fs from 'fs';
import path from 'path';
import { idlFactory as dodIDL } from './idls/dod.idl';
import { _SERVICE as dodService } from './idls/dod';
import { ActorSubclass, SignIdentity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import crypto, { BinaryLike, randomBytes } from 'crypto';
import { toHexString } from '@dfinity/candid';

import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';
import { Psbt } from 'bitcoinjs-lib';
import * as cbor from 'borc';
import { encode } from '@dfinity/agent/lib/cjs/cbor';
import { bitwork_match_hash, CborPayload, resolver_v3 } from './dmt';
import { reverseBuffer } from 'bitcoinjs-lib/src/bufferutils';
import * as bitcoin from 'bitcoinjs-lib';
import {
  addressToOutputScript,
  AddressType,
  ECPair,
  ECPairInterface,
  getKeypairInfo,
  prepareDodCommitAndRevealTx,
  prepareDodScripts,
  publicKeyToAddress,
  witnessStackToScriptWitness,
} from './bitcoin';
import config from '../config/config';
import { _createActor } from './baseConnection';
import { stdout } from 'process';
import { hasOwnProperty } from './dod';
import loading from 'loading-cli';
import { sleeper } from '@wizz-js/utils';
const BIP32Factory = require('bip32');
const bip39 = require('bip39');
const ecc = require('tiny-secp256k1');
bitcoin.initEccLib(ecc);

let dodActor: ActorSubclass<dodService>;

const DOD_CANISTERID = config.dod_canister;
const magicValue = 87960;

export async function init(wif: string) {
  const network = bitcoin.networks.bitcoin;
  const feeRate = 2;
  const signer = ECPair.fromWIF(wif, network);
  let pubkey = signer.publicKey;
  let addressType = AddressType.P2TR;
  let address = publicKeyToAddress(pubkey, addressType, network)!;
  const output = addressToOutputScript(address);
  return {
    address,
    pubkey: pubkey.toString('hex'),
    output,
    network,
    feeRate,
    signer,
  };
  // console.log(wif);
}

export async function register(identity: SignIdentity, address: string, ecdsa_pubkey: string) {
  const { actor } = await _createActor<dodService>(dodIDL, DOD_CANISTERID, identity);
  const r = await actor.register(address, ecdsa_pubkey);
  if (hasOwnProperty(r, 'Ok')) {
    return r.Ok;
  } else {
    if (r.Err.includes('already registered')) {
      return r.Err;
    }
  }
}

//  async function getLatestBlocks (){
//     const l = await dodActor.get_last_block();
//     const s = await dodActor.get_blocks_range(BigInt(0), l[0] === undefined ? BigInt(0) : l[0][0] === BigInt(0) ? BigInt(0) : l[0][0] - BigInt(1));
//     for (let r = 0; r < s.length; r++) {
//       console.log({
//         block_time: s[r].block_time,
//         height: s[r].height,
//         hash: toHexString(new Uint8Array(s[r].hash)),
//         difficulty: s[r].difficulty,
//         winner: s[r].winner,
//         next_block_time: s[r].next_block_time,
//         rewards: s[r].rewards,
//       });
//       const sigs = await dodActor.load_sigs_by_height(s[r].height);
//       console.log({ sigs });
//     }
//   };

const timer = ms => new Promise(res => setTimeout(res, ms));

export async function mine(
  delegation: SignIdentity,
  address: string,
  pubkey: string,
  output: Buffer,
  signer: ECPairInterface,
  cycles_price: string,
  loading: loading.Loading,
) {
  const { actor: dodActor } = await _createActor<dodService>(dodIDL, DOD_CANISTERID, delegation);

  const feeRate = 2;
  const network = bitcoin.networks.bitcoin;
  let remote_hash;
  let bitwork;
  let isMined = false;
  let next_block_time;
  let blockHeight;

  while (true) {
    loading.start('Checking for the next block ... ');
    const lb = await dodActor.get_last_block();
    if (lb.length === 1) {
      const block = lb[0][1];
      remote_hash = toHexString(new Uint8Array(block.hash));
      bitwork = block.difficulty;
      isMined = block.winner.length > 0;
      next_block_time = block.next_block_time;
      blockHeight = block.height;
      loading.text = blockHeight.toString();
    }
    loading.stop();
    let isLess = BigInt(Date.now()) * BigInt(1000000) < BigInt(next_block_time);
    const diff = Number.parseInt((BigInt(next_block_time) / BigInt(1000000)).toString()) - Date.now();
    const amICandidate = await dodActor.am_i_candidate(blockHeight);
    if (isLess && amICandidate) {
      loading.start('Waiting for the next block ... ');
      await timer(diff);
      loading.stop();
    }

    if (!isMined && lb.length === 1 && blockHeight && remote_hash && bitwork && isLess) {
      if (!amICandidate) {
        let reverse_hash = Buffer.from(remote_hash, 'hex').reverse().toString('hex');

        const utxos = [
          {
            txid: reverse_hash,
            vout: 0,
            value: magicValue,
          },
        ];

        const fundingUtxo = utxos[0];

        let commitPsbt;
        let revealPsbt;

        let time = 1700000000;
        let nonce = 9999999;
        let isMined = false;
        let found = false;

        let payload = {
          t: 'DMT',
          dmt: {
            nonce,
            time,
          },
        };

        let minePayload = cbor.encode(payload) as unknown as Buffer;
        // console.log({ minePayload: minePayload.toString('hex') });

        let cb = CborPayload.fromCbor(minePayload);

        const xonlyPubkey = toXOnly(Buffer.from(pubkey, 'hex'));

        // console.log(xonlyPubkey.toString('hex'));

        // console.log(xonlyPubkey.toString('hex'));
        const fundingKeypair = getKeypairInfo(signer, network);

        const revealOutputs = [
          {
            // receiver
            address,
            value: 546,
          },
        ];

        let txResult = prepareDodCommitAndRevealTx({
          // safe btc utxos
          utxos,
          feeRate,
          network,
          // reveal input number, default is 1
          revealInputs: 1,
          // reveal outputs
          revealOutputs,
          payload: minePayload,
          opType: 'mine',
        });

        const s = resolver_v3('mine', fundingKeypair, cb, txResult.revealNeed, fundingUtxo, network, { script: output, value: txResult.change });

        while (!isMined && Number.parseInt((BigInt(next_block_time) / BigInt(1000000)).toString()) - Date.now() > 5000) {
          const hex = randomBytes(16);
          let b = Buffer.from(s.tx.buffer, 'hex');
          b.set(hex, s.tx.opReturn.start + s.tx.opReturn.start_offset);
          let hex2 = reverseBuffer(bitcoin.crypto.hash256(b)).toString('hex');

          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(hex2);

          if (bitwork_match_hash(hex2, remote_hash, bitwork, false)) {
            const { hashLockP2TR, scriptP2TR, hashscript } = prepareDodScripts(xonlyPubkey, 'mine', minePayload, network);
            const op_return_asm = `OP_RETURN ${hex.toString('hex')}`;
            const op_return_script = bitcoin.script.fromASM(op_return_asm);
            let psbtRecv = new bitcoin.Psbt({ network });
            // console.log({ fundingUtxo });
            psbtRecv.setVersion(1);
            psbtRecv.addInput({
              hash: fundingUtxo.txid,
              index: fundingUtxo.vout,
              witnessUtxo: { value: fundingUtxo.value, script: Buffer.from(fundingKeypair.output, 'hex') },
              tapInternalKey: fundingKeypair.childNodeXOnlyPubkey,
              sequence: 0xfffffffd,
            });

            // reveal
            psbtRecv.addOutput({
              address: scriptP2TR.address!,
              value: txResult.revealNeed,
            });

            // opreturn
            psbtRecv.addOutput({
              script: op_return_script,
              value: 0,
            });
            // service fee

            psbtRecv.addOutput({ script: output, value: txResult.change });

            // this.addCommitChangeOutputIfRequired(fundingUtxo.value, fees, psbtStart, expectedCommitTx.hashscript.length, fundingKeypair.address);
            psbtRecv.signInput(0, fundingKeypair.tweakedChildNode);
            psbtRecv.finalizeAllInputs();

            let commitTx = psbtRecv.extractTransaction();

            const commitTxId = commitTx.getId();
            const commitTxRaw = commitTx.toHex();

            const revealInputs = {
              txid: commitTxId,
              vout: 0,
              value: txResult.revealNeed,
            };

            const tapLeafScript = {
              leafVersion: hashLockP2TR!.redeem!.redeemVersion,
              script: hashLockP2TR!.redeem!.output,
              controlBlock: hashLockP2TR.witness![hashLockP2TR.witness!.length - 1],
            };

            let psbt = new Psbt({ network });
            psbt.setVersion(1);
            psbt.addInput({
              hash: revealInputs.txid,
              index: revealInputs.vout,
              witnessUtxo: { value: revealInputs.value, script: hashLockP2TR.output! },
              tapLeafScript: [tapLeafScript as any],
              sequence: 0xfffffffd,
            });

            psbt.addOutput({
              address: address,
              value: 546,
            });

            const customFinalizer = (_inputIndex: number, input: any) => {
              const scriptSolution = [input.tapScriptSig[0].signature];
              const witness = scriptSolution.concat(tapLeafScript.script).concat(tapLeafScript.controlBlock);
              return {
                finalScriptWitness: witnessStackToScriptWitness(witness),
              };
            };

            psbt.signInput(0, fundingKeypair.childNode);

            const b64 = psbt.toBase64();
            // console.log({ b64 });
            const recoveredPsbt = Psbt.fromBase64(b64);
            recoveredPsbt.finalizeInput(0, customFinalizer);
            const tx = recoveredPsbt.extractTransaction();
            const rawTx = tx.toHex();
            const revealTx = tx.getId();

            psbt.finalizeInput(0, customFinalizer);
            const revealT = psbt.extractTransaction();
            const revealTxRaw = revealT.toHex();
            const revealTxId = revealT.getId();
            commitPsbt = psbtRecv.toBase64();
            revealPsbt = psbt.toBase64();
            // console.log({ commitTxRaw, commitTxId, revealTxRaw, revealTxId, txResult, commitPsbt, revealPsbt });

            // const _commitTxId = await broadcast(commitTxRaw, network);
            // const _revealTxId = await broadcast(revealTxRaw, network);
            // if (_commitTxId !== commitTxId || _revealTxId !== revealTxId) {
            //   console.log(`shit: _commitTxId:\n ${_commitTxId}\n _revealTxId:\n ${_revealTxId}`);
            // } else {
            //   console.log({ commitTxId, revealTxId });
            // }
            isMined = true;
          }
        }

        if (commitPsbt && revealPsbt) {
          loading.start('Submitting ... ');
          const d = await dodActor.miner_submit_hash({
            signed_commit_psbt: commitPsbt,
            signed_reveal_psbt: revealPsbt,
            cycles_price: BigInt(cycles_price),
            btc_address: address,
          });
          if (hasOwnProperty(d, 'Ok')) {
            console.log(d.Ok);
          } else {
            console.log(d.Err);
          }
          loading.stop();
        }
      } else {
        loading.start('Already submitted, Waiting for the next block ... ');
        setTimeout(() => {
          loading.stop();
        }, diff);
      }
    }
  }
}

// export function getWasmFile(filePath: string): Uint8Array {
//   return fs.readFileSync(path.join(process.cwd(), filePath));
// }
