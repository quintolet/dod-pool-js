import { idlFactory as dodIdl } from './idls/dod.idl';
import { _SERVICE as dodService, MinerStatus, MinerSubmitPayload } from './idls/dod';

// import { idlFactory as ledgerIdl } from './ledger.idl';
// import { Account, _SERVICE as ledgerService } from './ledger';

import { _createActor } from './baseConnection';
import { SignIdentity } from '@dfinity/agent';
// import { DOD_CANISTERID, ICP_CANISTERID } from '@/shared/constant';

import { Principal } from '@dfinity/principal';
// import { asciiStringToByteArray, calculateCrc32 } from '@astrox/sdk-core/build/utils';
import { toHexString } from '@dfinity/candid';
import { sha224 } from 'js-sha256';
import Decimal from 'decimal.js';
import config from '../config/config';

const DOD_CANISTERID = config.dod_canister;

export interface BlockDataJson {
  height: string;
  block_time: string;
  hash: string;
  difficulty: string;
  winner: [] | [MinerInfoJson];
  next_block_time: string;
  rewards: string;
  dod_burned: string;
  cycle_burned: string;
  history: boolean;
}

export interface MinerInfoJson {
  status: MinerStatus;
  ecdsa_pubkey: string;
  owner: string;
  btc_address: string;
  reward_cycles: [] | [string];
}

export async function getLatestBlock(identity?: SignIdentity) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.get_last_block();
}

export async function getBlocksRange(start: bigint, end: bigint, identity?: SignIdentity) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.get_blocks_range(start, end);
}

export async function getCandidates(height: bigint, identity?: SignIdentity) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.get_history_miner_candidates(height);
}

export async function registerUser(identity: SignIdentity) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.user_register();
}

export async function getUserDetail(identity: SignIdentity) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.get_user_detail();
}

// export async function getICPBalance(identity: SignIdentity) {
//   const { actor } = await _createActor<ledgerService>(ledgerIdl, ICP_CANISTERID, identity);
//   return await actor.icrc1_balance_of({ owner: identity.getPrincipal(), subaccount: [] });
// }
// export async function getUserTreasuryICP(identity: SignIdentity) {
//   const { actor } = await _createActor<ledgerService>(ledgerIdl, ICP_CANISTERID);
//   const sub = await getUserTreasurySub(identity);
//   return await actor.icrc1_balance_of({ owner: Principal.fromText(DOD_CANISTERID), subaccount: [Array.from(sub)] });
// }

// export async function transferICPFromWalletTo(identity: SignIdentity, amount: bigint, to: Account) {
//   const { actor } = await _createActor<ledgerService>(ledgerIdl, ICP_CANISTERID, identity);
//   return await actor.icrc1_transfer({
//     to,
//     fee: [BigInt(10000)],
//     memo: [],
//     from_subaccount: [],
//     created_at_time: [BigInt(Date.now()) * BigInt(1000_000)],
//     amount,
//   });
// }

export interface Account {
  owner: Principal;
  subaccount: [Array<number>] | [];
}

export async function getTopupAccountWithSub(identity: SignIdentity): Promise<Account> {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  const sub = await actor.get_user_subaccount(identity.getPrincipal());
  return { owner: Principal.fromText(DOD_CANISTERID), subaccount: [sub] };
}

export async function claimDodtoWallet(identity: SignIdentity) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  const sub = await actor.claim_dod_to_wallet();
  if (hasOwnProperty(sub, 'Ok')) {
    return sub.Ok;
  } else {
    throw new Error(sub.Err);
  }
}

export async function getUserTreasurySub(identity: SignIdentity) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  const sub = await actor.get_user_subaccount(identity.getPrincipal());
  return new Uint8Array(sub);
}

export async function topupCyclesFromICP(identity: SignIdentity, amount: bigint) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.deposit_cycles_from_icp(amount);
}

// export async function getTopupAccount(identity: SignIdentity) {
//   const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
//   const sub = await actor.get_user_subaccount(identity.getPrincipal());
//   return principalToAccountIdentifier(Principal.fromText(DOD_CANISTERID), new Uint8Array(sub));
// }

export async function userSetBurningRate(br: bigint, identity: SignIdentity) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.user_set_burning_rate(br);
}

// start height is smaller than end height
export async function getUserOrdersByBlocks(start: bigint, end: bigint, identity: SignIdentity) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.get_user_orders_by_blocks(start, end, { User: null });
}

export async function userPutBurningOrders(start: bigint, identity: SignIdentity) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.user_put_orders(start);
}

export async function get_dod_canister() {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID);
  return await actor.get_dod_canister();
}

// export async function get_treasury_balance() {
//   const sub = Array.from(new Uint8Array(32));
//   sub.fill(0);
//   sub[31] = 0x81;
//   const dod = await get_dod_canister();
//   let balance;
//   if (hasOwnProperty(dod, 'Ok')) {
//     console.log(dod.Ok.toText());
//     const { actor } = await _createActor<ledgerService>(ledgerIdl, dod.Ok.toText());
//     balance = await actor.icrc1_balance_of({
//       owner: Principal.fromText(DOD_CANISTERID),
//       subaccount: [sub],
//     });
//   } else {
//     balance = BigInt(0);
//   }
//   return balance;
// }

// export async function get_wallet_dod_balance(id: SignIdentity) {
//   const dod = await get_dod_canister();
//   let balance;
//   if (hasOwnProperty(dod, 'Ok')) {
//     console.log(dod.Ok.toText());
//     const { actor } = await _createActor<ledgerService>(ledgerIdl, dod.Ok.toText());
//     balance = await actor.icrc1_balance_of({
//       owner: id.getPrincipal(),
//       subaccount: [],
//     });
//   } else {
//     balance = BigInt(0);
//   }
//   return balance;
// }

export function hasOwnProperty<X extends Record<string, unknown>, Y extends PropertyKey>(
  obj: Record<string, unknown>,
  prop: Y,
): obj is X & Record<Y, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

// export const principalToAccountIdentifier = (principal: Principal, subAccount?: Uint8Array): string => {
//   // Hash (sha224) the principal, the subAccount and some padding
//   const padding = asciiStringToByteArray('\x0Aaccount-id');

//   const shaObj = sha224.create();
//   shaObj.update([...padding, ...principal.toUint8Array(), ...(subAccount ?? Array(32).fill(0))]);
//   const hash = new Uint8Array(shaObj.array());

//   // Prepend the checksum of the hash and convert to a hex string
//   const checksum = calculateCrc32(hash);
//   const bytes = new Uint8Array([...checksum, ...hash]);
//   return toHexString(bytes);
// };

export function getTCycles(bn: bigint) {
  return new Decimal(bn.toString()).div(new Decimal(1_000_000_000_000)).toString();
}

export function getDOD(bn: bigint) {
  return new Decimal(bn.toString()).div(new Decimal(100_000_000)).toFixed(4);
}

export async function isMiner(identity: SignIdentity, address: string) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.is_miner(address);
}

export async function registerMiner(identity: SignIdentity, address: string, ecdsa_pubkey: string) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.register(address, ecdsa_pubkey);
}

export async function minerSubmitHash(identity: SignIdentity, payload: MinerSubmitPayload) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.miner_submit_hash(payload);
}

export async function amICandidate(identity: SignIdentity, height: bigint) {
  const { actor } = await _createActor<dodService>(dodIdl, DOD_CANISTERID, identity);
  return await actor.am_i_candidate(height);
}
