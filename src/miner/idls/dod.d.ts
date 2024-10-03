import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface AppInfo {
  app_id: string;
  current_version: Version;
  latest_version: Version;
  wallet_id: [] | [Principal];
}
export interface Bitwork {
  pre: bigint;
  post_hex: string;
}
export interface BlockData {
  height: bigint;
  dod_burned: bigint;
  block_time: bigint;
  hash: Array<number>;
  difficulty: Bitwork;
  winner: [] | [MinerInfo];
  history: boolean;
  next_block_time: bigint;
  cycle_burned: bigint;
  rewards: bigint;
}
export interface BlockSigs {
  reveal_tx: Array<number>;
  commit_tx: Array<number>;
}
export interface BootStrapParams {
  halving_settings: [] | [HalvingSettings];
  default_rewards: bigint;
  dod_token_canister: [] | [Principal];
  block_timer: bigint;
  dod_block_sub_account: Array<number>;
  start_difficulty: [] | [Bitwork];
  difficulty_epoch: bigint;
}
export interface DodCanisters {
  ledger: Principal;
  archive: Principal;
  index: Principal;
}
export interface HalvingSettings {
  interval: bigint;
  ratio: number;
}
export interface LogEntry {
  ts: bigint;
  msg: string;
  kind: string;
}
export interface MinerCandidate {
  submit_time: bigint;
  signed_commit_psbt: string;
  signed_reveal_psbt: string;
  cycles_price: bigint;
  btc_address: string;
}
export interface MinerInfo {
  status: MinerStatus;
  ecdsa_pubkey: Array<number>;
  owner: Principal;
  claimed_dod: bigint;
  total_dod: bigint;
  btc_address: string;
  reward_cycles: [] | [bigint];
}
export type MinerStatus = { Deactivate: null } | { Activate: null };
export interface MinerSubmitPayload {
  signed_commit_psbt: string;
  signed_reveal_psbt: string;
  cycles_price: bigint;
  btc_address: string;
}
export interface MinerSubmitResponse {
  cycles_price: bigint;
  block_height: bigint;
}
export type Result = { Ok: null } | { Err: string };
export type Result_1 = { Ok: string } | { Err: string };
export type Result_10 = { Ok: MinerInfo } | { Err: string };
export type Result_2 = { Ok: Principal } | { Err: string };
export type Result_3 = { Ok: AppInfo } | { Err: string };
export type Result_4 = { Ok: Array<[string, Array<Principal>]> } | { Err: string };
export type Result_5 = { Ok: boolean } | { Err: string };
export type Result_6 = { Ok: Array<LogEntry> } | { Err: string };
export type Result_7 = { Ok: [] | [Array<[Principal, string]>] } | { Err: string };
export type Result_8 = { Ok: Array<MinerCandidate> } | { Err: string };
export type Result_9 = { Ok: MinerSubmitResponse } | { Err: string };
export interface UserBlockOrder {
  reward: bigint;
  share: number;
  block: bigint;
  amount: bigint;
}
export interface UserBlockOrderRes {
  to: bigint;
  total: bigint;
  data: Array<UserBlockOrder>;
  from: bigint;
}
export interface UserDetail {
  principal: Principal;
  balance: bigint;
  claimed_dod: bigint;
  subaccount: Array<number>;
  cycle_burning_rate: bigint;
  total_dod: bigint;
}
export type UserType = { User: null } | { Miner: null } | { Treasury: null };
export interface Version {
  major: number;
  minor: number;
  patch: number;
}
export interface _SERVICE {
  add_archive_wasm: ActorMethod<[Array<number>], Result>;
  add_index_wasm: ActorMethod<[Array<number>], Result>;
  add_ledger_wasm: ActorMethod<[Array<number>], Result>;
  am_i_candidate: ActorMethod<[bigint], boolean>;
  bootstrap: ActorMethod<[BootStrapParams], undefined>;
  claim_dod_to_wallet: ActorMethod<[], Result_1>;
  clean_up: ActorMethod<[], undefined>;
  deploy_canisters: ActorMethod<[], Result_2>;
  deposit_cycles_from_icp: ActorMethod<[bigint], Result>;
  ego_app_info_get: ActorMethod<[], Result_3>;
  ego_app_info_update: ActorMethod<[[] | [Principal], string, Version], undefined>;
  ego_app_version_check: ActorMethod<[], Result_3>;
  ego_canister_add: ActorMethod<[string, Principal], Result>;
  ego_canister_delete: ActorMethod<[], Result>;
  ego_canister_list: ActorMethod<[], Result_4>;
  ego_canister_remove: ActorMethod<[string, Principal], Result>;
  ego_canister_track: ActorMethod<[], Result>;
  ego_canister_untrack: ActorMethod<[], Result>;
  ego_canister_upgrade: ActorMethod<[], Result>;
  ego_controller_add: ActorMethod<[Principal], Result>;
  ego_controller_remove: ActorMethod<[Principal], Result>;
  ego_controller_set: ActorMethod<[Array<Principal>], Result>;
  ego_is_op: ActorMethod<[], Result_5>;
  ego_is_owner: ActorMethod<[], Result_5>;
  ego_is_user: ActorMethod<[], Result_5>;
  ego_log_list: ActorMethod<[bigint], Result_6>;
  ego_op_add: ActorMethod<[Principal], Result>;
  ego_op_list: ActorMethod<[], Result_7>;
  ego_op_remove: ActorMethod<[Principal], Result>;
  ego_owner_add: ActorMethod<[Principal], Result>;
  ego_owner_add_with_name: ActorMethod<[string, Principal], Result>;
  ego_owner_list: ActorMethod<[], Result_7>;
  ego_owner_remove: ActorMethod<[Principal], Result>;
  ego_owner_set: ActorMethod<[Array<Principal>], Result>;
  ego_user_add: ActorMethod<[Principal], Result>;
  ego_user_list: ActorMethod<[], Result_7>;
  ego_user_remove: ActorMethod<[Principal], Result>;
  ego_user_set: ActorMethod<[Array<Principal>], Result>;
  get_blocks_range: ActorMethod<[bigint, bigint], Array<BlockData>>;
  get_canister_cycles: ActorMethod<[], bigint>;
  get_deployed_canisters: ActorMethod<[], [] | [DodCanisters]>;
  get_dod_canister: ActorMethod<[], Result_2>;
  get_history_miner_candidates: ActorMethod<[bigint], Result_8>;
  get_last_block: ActorMethod<[], [] | [[bigint, BlockData]]>;
  get_ledger_wasm: ActorMethod<[], [] | [Array<number>]>;
  get_user_detail: ActorMethod<[], [] | [UserDetail]>;
  get_user_orders_by_blocks: ActorMethod<[bigint, bigint, UserType], UserBlockOrderRes>;
  get_user_subaccount: ActorMethod<[Principal], Array<number>>;
  is_miner: ActorMethod<[string], [] | [MinerInfo]>;
  load_sigs_by_height: ActorMethod<[bigint], [] | [BlockSigs]>;
  miner_submit_hash: ActorMethod<[MinerSubmitPayload], Result_9>;
  register: ActorMethod<[string, string], Result_10>;
  start_generating_blocks: ActorMethod<[], Result>;
  user_put_orders: ActorMethod<[bigint], Result>;
  user_register: ActorMethod<[], Result>;
  user_set_burning_rate: ActorMethod<[bigint], Result>;
  whoAmI: ActorMethod<[], Principal>;
}
