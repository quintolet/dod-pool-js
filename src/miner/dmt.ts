import * as bitcoin from 'bitcoinjs-lib';
import { KeyPairInfo, prepareDodScripts } from './bitcoin';
import { BufferWriter, reverseBuffer } from 'bitcoinjs-lib/src/bufferutils';
import * as cbor from 'borc';
import { Bitwork } from './idls/dod';

export function bitwork_from_height(currentHeight: number, deploy_height: number, difficulty_epoch: number): Bitwork {
  if (difficulty_epoch == 0) {
    throw 'Invalid difficulty epoch';
  }
  let diff = Math.floor((currentHeight - deploy_height) / difficulty_epoch);
  let pre = Math.floor(diff / 16);

  let post_hex = (diff % 16).toString(16);
  let _pre = pre;
  if (pre > 64) {
    _pre = 64;
  }
  if (_pre == 64 && post_hex != '0') {
    post_hex = '0';
  }
  return { pre: BigInt(_pre), post_hex };
}

// pub fn bitwork_from_fee(fee: u64) -> Result<Bitwork, String> {
//   let raw = (fee as f64).ln();
//   let post = (raw - raw.floor()) * 16.0;
//   let pre = format!("{}", raw.floor() as u32);
//   let mut post_hex = format!("{:x}", post.floor() as u32);
//   let mut _pre = pre.parse::<u32>().unwrap();
//   if pre.parse::<u32>().unwrap() > 32 {
//       _pre = 32;
//   }
//   if _pre == 32 && post_hex != "0" {
//       post_hex = "0".to_string();
//   }
//   Ok(Bitwork {
//       pre: _pre,
//       post_hex,
//   })
// }

export function bitwork_from_fee(fee: number): Bitwork {
  let raw = Math.log(fee);
  let post = (raw - Math.floor(raw)) * 16;
  let pre = Math.floor(raw);
  let post_hex = Math.floor(post).toString(16);
  let _pre = pre;
  if (pre > 64) {
    _pre = 64;
  }
  if (_pre == 64 && post_hex != '0') {
    post_hex = '0';
  }
  return { pre: BigInt(_pre), post_hex };
}

// pub fn merge_bitwork(bitwork_height: Bitwork, bitwork_tx: Bitwork) -> Bitwork {
//   let mut pre = bitwork_height.pre + bitwork_tx.pre;
//   let post = u32::from_str_radix(bitwork_height.post_hex.as_str(), 16).unwrap()
//       + u32::from_str_radix(bitwork_tx.post_hex.as_str(), 16).unwrap();
//   let _post = post / 16;
//   let mut post = format!("{:x}", (post % 16) as u8);
//   pre += _post;
//   if pre > 32 {
//       pre = 32;
//   }
//   if pre == 32 {
//       post = "0".to_string();
//   }

//   Bitwork {
//       pre,
//       post_hex: post,
//   }
// }

export function merge_bitwork(bitwork_height: Bitwork, bitwork_tx: Bitwork) {
  let pre = bitwork_height.pre + bitwork_tx.pre;
  let post = parseInt(bitwork_height.post_hex, 16) + parseInt(bitwork_tx.post_hex, 16);
  let _post = Math.floor(post / 16);
  let post_hex = (post % 16).toString(16);
  pre += BigInt(_post);
  if (pre > BigInt(64)) {
    pre = BigInt(64);
  }
  if (pre == BigInt(64)) {
    post_hex = '0';
  }
  return { pre, post_hex };
}

// pub fn bitwork_match_hash(
//   current_hash: String,
//   target_hash: String,
//   bitwork: Bitwork,
// ) -> Result<bool, String> {
//   let mut target =
//       hex::decode(target_hash.as_str()).map_err(|_| "Invalid target hash".to_string())?;

//   if target.len() != 32 {
//       return Err("Invalid target hash width".to_string());
//   }

//   let current =
//       hex::decode(current_hash.as_str()).map_err(|_| "Invalid current hash".to_string())?;
//   if current.len() != 32 {
//       return Err("Invalid current hash width".to_string());
//   }

//   target.reverse();

//   let target_string = hex::encode(target);
//   let binding1 = current_hash.clone();
//   let current_pre = binding1.get(..bitwork.pre as usize);

//   if current_pre.is_none() {
//       return Err("Invalid bitwork".to_string());
//   }
//   let binding2 = current_hash.clone();

//   let current_post = binding2.get(bitwork.pre as usize..bitwork.pre as usize + 1);
//   if current_post.is_none() {
//       return Err("Invalid bitwork".to_string());
//   }

//   let binding3 = target_string.clone();
//   let target_pre = binding3.get(..bitwork.pre as usize);
//   if target_pre.is_none() {
//       return Err("Invalid bitwork".to_string());
//   }

//   let binding4 = target_string.clone();

//   let target_post = binding4.get(bitwork.pre as usize..bitwork.pre as usize + 1);
//   if target_post.is_none() {
//       return Err("Invalid bitwork".to_string());
//   }

//   if current_pre.unwrap() == target_pre.unwrap()
//       && u32::from_str_radix(current_post.unwrap(), 16).unwrap()
//           >= u32::from_str_radix(bitwork.post_hex.as_str(), 16).unwrap()
//   {
//       Ok(true)
//   } else {
//       Ok(false)
//   }
// }
export function bitwork_match_hash(current_hash: string, target_hash: string, bitwork: Bitwork, reverse: boolean): boolean {
  let target = Buffer.from(target_hash, 'hex');
  if (target.length != 32) {
    throw 'Invalid target hash width';
  }

  let current = Buffer.from(current_hash, 'hex');
  if (current.length != 32) {
    throw 'Invalid current hash width';
  }
  if (reverse) {
    target.reverse();
  }

  let target_string = target.toString('hex');
  let current_pre = current_hash.substring(0, Number.parseInt(bitwork.pre.toString()));

  if (current_pre == null) {
    throw 'Invalid bitwork';
  }

  let current_post = current_hash.substring(Number.parseInt(bitwork.pre.toString()), Number.parseInt(bitwork.pre.toString()) + 1);
  if (current_post == null) {
    throw 'Invalid bitwork';
  }

  let target_pre = target_string.substring(0, Number.parseInt(bitwork.pre.toString()));
  if (target_pre == null) {
    throw 'Invalid bitwork';
  }

  let target_post = target_string.substring(Number.parseInt(bitwork.pre.toString()), Number.parseInt(bitwork.pre.toString()) + 1);
  if (target_post == null) {
    throw 'Invalid bitwork';
  }

  if (current_pre == target_pre && parseInt(current_post, 16) >= parseInt(bitwork.post_hex, 16)) {
    return true;
  } else {
    return false;
  }
}

export interface TxResolver {
  buffer: string;
  head: string;
  tail: string;
  script: {
    start: number;
    end: number;
  };
  opReturn: {
    start: number;
    end: number;
    start_offset: number;
    start_offset_bytes: string;
  };
}

export interface CommitResolver {
  asm_bytes: string;
  cbor: {
    head: string;
    cbor_start: number;
    time: {
      bytes?: string;
      start: number;
      end: number;
    };
    nonce: {
      bytes?: string;
      start: number;
      end: number;
    };
  };
  tx: TxResolver;
  internalPubkey: string;
  network: string;
}

export const resolver_v3 = (
  opType: 'init' | 'mint' | 'tele' | 'burn' | 'call' | 'send' | 'dele' | 'stak' | 'mine',
  keypair: KeyPairInfo,
  cborPayload: CborPayload,
  totalFee: number,
  fundingUtxo: {
    txid: string;
    value: number;
    vout: number;
  },
  network: bitcoin.Network,
  serviceOutput?: {
    script: Buffer;
    value: number;
  },
  test_return_hex?: string,
): CommitResolver => {
  const cbor = cborPayload.cbor();
  const cborString = cbor.toString('hex');
  const time_pre_head = cborString.split('74696d65')[0].length;
  const timeStart = time_pre_head / 2 + 4 + 1;
  const timeEnd = timeStart + 4;
  const nonce_pre_head = cborString.split('6e6f6e6365')[0].length;
  const nonceStart = nonce_pre_head / 2 + 5 + 1;
  const nonceEnd = nonceStart + 4;
  const op_return_hex = test_return_hex ?? '9d4b1212d0c917e668e55bbeb5eda717'; //'f000000000000000000000000000000f';
  const op_return_asm = `OP_RETURN ${op_return_hex}`;
  const op_return_script = bitcoin.script.fromASM(op_return_asm);

  const head = cbor.slice(0, nonceStart); // nonce is going to insert after head

  const { hashscript, scriptP2TR } = prepareDodScripts(keypair.childNodeXOnlyPubkey, opType, cborPayload.cbor(), network);

  const simulateTx = new bitcoin.Transaction();
  simulateTx.addInput(reverseBuffer(Buffer.from(fundingUtxo.txid, 'hex')), fundingUtxo.vout, 0xfffffffd);
  simulateTx.addOutput(scriptP2TR.output!, totalFee);
  simulateTx.addOutput(op_return_script, 0);
  if (serviceOutput) {
    simulateTx.addOutput(serviceOutput.script, serviceOutput.value);
  }

  const cbor_start = hashscript.toString('hex').split(`${head.toString('hex')}`)[0].length / 2;

  const tx = txToBuffer3(simulateTx, false, serviceOutput ? true : false);

  let psbtStart = new bitcoin.Psbt({ network });
  psbtStart.setVersion(1);
  psbtStart.addInput({
    hash: fundingUtxo.txid,
    index: fundingUtxo.vout,
    witnessUtxo: { value: fundingUtxo.value, script: Buffer.from(keypair.output, 'hex') },
    tapInternalKey: keypair.childNodeXOnlyPubkey,
    sequence: 0xfffffffd,
  });

  // reveal
  psbtStart.addOutput({
    address: scriptP2TR.address!,
    value: totalFee,
  });

  // opreturn
  psbtStart.addOutput({
    script: op_return_script,
    value: 0,
  });

  // service fee
  if (serviceOutput) {
    psbtStart.addOutput({
      script: serviceOutput.script,
      value: serviceOutput.value,
    });
  }

  // this.addCommitChangeOutputIfRequired(fundingUtxo.value, fees, psbtStart, expectedCommitTx.hashscript.length, fundingKeypair.address);
  psbtStart.signInput(0, keypair.tweakedChildNode);
  psbtStart.finalizeAllInputs();
  let prelimTx = psbtStart.extractTransaction();
  let txid = simulateTx.getId();

  const checkTxid = prelimTx.getId();
  if (checkTxid !== txid) {
    throw 'ERROR_INVALID_TX';
  }

  return {
    asm_bytes: hashscript.toString('hex'),
    cbor: {
      head: head.toString('hex'),
      cbor_start,
      time: {
        bytes: undefined,
        start: timeStart,
        end: timeEnd,
      },
      nonce: {
        bytes: undefined,
        start: nonceStart,
        end: nonceEnd,
      },
    },
    tx,
    internalPubkey: keypair.childNodeXOnlyPubkey.toString('hex'),
    network: network === bitcoin.networks.testnet ? 'testnet' : 'mainnet',
  };
};

export function txToBuffer3(simulateTx: bitcoin.Transaction, debug = false, withPlatform = false): TxResolver {
  if (debug) {
    console.log('\n byteLength: ' + simulateTx.byteLength(false));
    console.log('version: ' + simulateTx.version);
    console.log('ins.length: ' + simulateTx.ins.length);
  }

  const buffer = Buffer.allocUnsafe(simulateTx.byteLength(false)) as Buffer;
  const bufferWriter = new BufferWriter(buffer, 0);
  bufferWriter.writeInt32(simulateTx.version);
  bufferWriter.writeVarInt(simulateTx.ins.length);
  const txIn = simulateTx.ins[0];
  if (debug) {
    console.log('txIn.hash: ' + txIn.hash.toString('hex'));
    console.log('txIn.index: ' + txIn.index);
    console.log('txIn.script: ' + txIn.script.toString('hex'));
    console.log('txIn.sequence: ' + txIn.sequence.toString(16));
    console.log('simulateTx.outs.length: ' + simulateTx.outs.length);
  }
  bufferWriter.writeSlice(txIn.hash);
  bufferWriter.writeUInt32(txIn.index);
  bufferWriter.writeVarSlice(txIn.script);
  bufferWriter.writeUInt32(txIn.sequence);
  bufferWriter.writeVarInt(simulateTx.outs.length);
  const target = simulateTx.outs[0];
  bufferWriter.writeUInt64(target.value);
  const scriptStart = bufferWriter.offset;
  bufferWriter.writeVarSlice(target.script);
  const scriptEnd = bufferWriter.offset;
  const opReturnStart = bufferWriter.offset;
  const opReturn = simulateTx.outs[1];
  bufferWriter.writeUInt64(opReturn.value);
  bufferWriter.writeVarSlice(opReturn.script);
  const opReturnEnd = bufferWriter.offset;
  let service;
  if (withPlatform) {
    service = simulateTx.outs[2];
    bufferWriter.writeUInt64(service.value);
    bufferWriter.writeVarSlice(service.script);
  }

  bufferWriter.writeUInt32(0);
  if (debug) {
    console.log('target.value: ' + target.value);
    console.log('target.script: ' + target.script.toString('hex'));
    console.log('opReturn.value: ' + opReturn.value);
    console.log('opReturn.script: ' + opReturn.script.toString('hex'));
    if (withPlatform) {
      console.log('service.value: ' + service.value);
      console.log('service.script: ' + service.script.toString('hex'));
    }
    console.log('complete Buffer: ' + buffer.toString('hex'));
  }
  const ret = {
    buffer: buffer.toString('hex'),
    head: buffer.subarray(0, scriptStart).toString('hex'),
    tail: buffer.subarray(opReturnEnd).toString('hex'),
    script: {
      start: scriptStart,
      end: scriptEnd,
    },
    opReturn: {
      start: opReturnStart,
      end: opReturnEnd,
      start_offset: 11,
      start_offset_bytes: '0000000000000000126a10',
    },
  };

  // avoid slicing unless necessary
  return ret;
}

export class CborPayload {
  private cborEncoded;
  constructor(private originalData: any) {
    if (!originalData) {
      this.originalData = {};
      return;
    }

    function deepEqual(x, y) {
      const ok = Object.keys,
        tx = typeof x,
        ty = typeof y;
      return x && y && tx === 'object' && tx === ty ? ok(x).length === ok(y).length && ok(x).every(key => deepEqual(x[key], y[key])) : x === y;
    }

    function isAllowedtype(tc: any, allowBuffer = true): boolean {
      if (tc === 'object' || tc === 'Number' || tc === 'number' || tc === 'null' || tc === 'string' || tc == 'boolean') {
        return true;
      }
      if (allowBuffer && tc === 'buffer') {
        return true;
      }
      return false;
    }

    function validateWhitelistedDatatypes(x, allowBuffer = true) {
      const ok = Object.keys;
      const tx = typeof x;
      const isAllowed = isAllowedtype(tx, allowBuffer);
      if (!isAllowed) {
        return false;
      }
      if (tx === 'object') {
        return ok(x).every(key => validateWhitelistedDatatypes(x[key], allowBuffer));
      }
      return true;
    }

    if (!validateWhitelistedDatatypes(originalData)) {
      throw new Error('Invalid payload contains disallowed data types. Use only number, string, null, or buffer');
    }

    // Also make sure that if either args, ctx, init, or meta are provided, then we never allow buffer.
    if (originalData['args']) {
      if (!validateWhitelistedDatatypes(originalData['args'], false)) {
        throw 'args field invalid due to presence of buffer type';
      }
    }
    if (originalData['ctx']) {
      if (!validateWhitelistedDatatypes(originalData['ctx'], false)) {
        throw 'ctx field invalid due to presence of buffer type';
      }
    }
    if (originalData['meta']) {
      if (!validateWhitelistedDatatypes(originalData['meta'], false)) {
        throw 'meta field invalid due to presence of buffer type';
      }
    }

    const payload = {
      ...originalData,
    };

    const cborEncoded = cbor.encode(payload);
    // Decode to do sanity check
    const cborDecoded = (cbor as any).decode(cborEncoded);
    if (!deepEqual(cborDecoded, payload)) {
      throw 'CBOR Decode error objects are not the same. Developer error';
    }
    if (!deepEqual(originalData, payload)) {
      throw 'CBOR Payload Decode error objects are not the same. Developer error';
    }
    this.cborEncoded = cborEncoded;
  }
  get(): any {
    return this.originalData;
  }
  cbor(): any {
    return this.cborEncoded;
  }
  public static fromCbor(cborEncoded: Buffer): CborPayload {
    try {
      const payload = (cbor as any).decode(cborEncoded);
      return new CborPayload(payload);
    } catch (error) {
      throw error;
    }
  }
}
