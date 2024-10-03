export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const HalvingSettings = IDL.Record({
    'interval' : IDL.Nat64,
    'ratio' : IDL.Float64,
  });
  const Bitwork = IDL.Record({ 'pre' : IDL.Nat64, 'post_hex' : IDL.Text });
  const BootStrapParams = IDL.Record({
    'halving_settings' : IDL.Opt(HalvingSettings),
    'default_rewards' : IDL.Nat64,
    'dod_token_canister' : IDL.Opt(IDL.Principal),
    'block_timer' : IDL.Nat64,
    'dod_block_sub_account' : IDL.Vec(IDL.Nat8),
    'start_difficulty' : IDL.Opt(Bitwork),
    'difficulty_epoch' : IDL.Nat64,
  });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Principal, 'Err' : IDL.Text });
  const Version = IDL.Record({
    'major' : IDL.Nat32,
    'minor' : IDL.Nat32,
    'patch' : IDL.Nat32,
  });
  const AppInfo = IDL.Record({
    'app_id' : IDL.Text,
    'current_version' : Version,
    'latest_version' : Version,
    'wallet_id' : IDL.Opt(IDL.Principal),
  });
  const Result_3 = IDL.Variant({ 'Ok' : AppInfo, 'Err' : IDL.Text });
  const Result_4 = IDL.Variant({
    'Ok' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
    'Err' : IDL.Text,
  });
  const Result_5 = IDL.Variant({ 'Ok' : IDL.Bool, 'Err' : IDL.Text });
  const LogEntry = IDL.Record({
    'ts' : IDL.Nat64,
    'msg' : IDL.Text,
    'kind' : IDL.Text,
  });
  const Result_6 = IDL.Variant({ 'Ok' : IDL.Vec(LogEntry), 'Err' : IDL.Text });
  const Result_7 = IDL.Variant({
    'Ok' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Text))),
    'Err' : IDL.Text,
  });
  const MinerStatus = IDL.Variant({
    'Deactivate' : IDL.Null,
    'Activate' : IDL.Null,
  });
  const MinerInfo = IDL.Record({
    'status' : MinerStatus,
    'ecdsa_pubkey' : IDL.Vec(IDL.Nat8),
    'owner' : IDL.Principal,
    'claimed_dod' : IDL.Nat64,
    'total_dod' : IDL.Nat64,
    'btc_address' : IDL.Text,
    'reward_cycles' : IDL.Opt(IDL.Nat),
  });
  const BlockData = IDL.Record({
    'height' : IDL.Nat64,
    'dod_burned' : IDL.Nat64,
    'block_time' : IDL.Nat64,
    'hash' : IDL.Vec(IDL.Nat8),
    'difficulty' : Bitwork,
    'winner' : IDL.Opt(MinerInfo),
    'history' : IDL.Bool,
    'next_block_time' : IDL.Nat64,
    'cycle_burned' : IDL.Nat,
    'rewards' : IDL.Nat64,
  });
  const DodCanisters = IDL.Record({
    'ledger' : IDL.Principal,
    'archive' : IDL.Principal,
    'index' : IDL.Principal,
  });
  const MinerCandidate = IDL.Record({
    'submit_time' : IDL.Nat64,
    'signed_commit_psbt' : IDL.Text,
    'signed_reveal_psbt' : IDL.Text,
    'cycles_price' : IDL.Nat,
    'btc_address' : IDL.Text,
  });
  const Result_8 = IDL.Variant({
    'Ok' : IDL.Vec(MinerCandidate),
    'Err' : IDL.Text,
  });
  const UserDetail = IDL.Record({
    'principal' : IDL.Principal,
    'balance' : IDL.Nat,
    'claimed_dod' : IDL.Nat64,
    'subaccount' : IDL.Vec(IDL.Nat8),
    'cycle_burning_rate' : IDL.Nat,
    'total_dod' : IDL.Nat64,
  });
  const UserType = IDL.Variant({
    'User' : IDL.Null,
    'Miner' : IDL.Null,
    'Treasury' : IDL.Null,
  });
  const UserBlockOrder = IDL.Record({
    'reward' : IDL.Nat64,
    'share' : IDL.Float64,
    'block' : IDL.Nat64,
    'amount' : IDL.Nat,
  });
  const UserBlockOrderRes = IDL.Record({
    'to' : IDL.Nat64,
    'total' : IDL.Nat64,
    'data' : IDL.Vec(UserBlockOrder),
    'from' : IDL.Nat64,
  });
  const BlockSigs = IDL.Record({
    'reveal_tx' : IDL.Vec(IDL.Nat8),
    'commit_tx' : IDL.Vec(IDL.Nat8),
  });
  const MinerSubmitPayload = IDL.Record({
    'signed_commit_psbt' : IDL.Text,
    'signed_reveal_psbt' : IDL.Text,
    'cycles_price' : IDL.Nat,
    'btc_address' : IDL.Text,
  });
  const MinerSubmitResponse = IDL.Record({
    'cycles_price' : IDL.Nat,
    'block_height' : IDL.Nat64,
  });
  const Result_9 = IDL.Variant({
    'Ok' : MinerSubmitResponse,
    'Err' : IDL.Text,
  });
  const Result_10 = IDL.Variant({ 'Ok' : MinerInfo, 'Err' : IDL.Text });
  return IDL.Service({
    'add_archive_wasm' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result], []),
    'add_index_wasm' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result], []),
    'add_ledger_wasm' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result], []),
    'am_i_candidate' : IDL.Func([IDL.Nat64], [IDL.Bool], ['query']),
    'bootstrap' : IDL.Func([BootStrapParams], [], []),
    'claim_dod_to_wallet' : IDL.Func([], [Result_1], []),
    'clean_up' : IDL.Func([], [], []),
    'deploy_canisters' : IDL.Func([], [Result_2], []),
    'deposit_cycles_from_icp' : IDL.Func([IDL.Nat64], [Result], []),
    'ego_app_info_get' : IDL.Func([], [Result_3], ['query']),
    'ego_app_info_update' : IDL.Func(
        [IDL.Opt(IDL.Principal), IDL.Text, Version],
        [],
        [],
      ),
    'ego_app_version_check' : IDL.Func([], [Result_3], []),
    'ego_canister_add' : IDL.Func([IDL.Text, IDL.Principal], [Result], []),
    'ego_canister_delete' : IDL.Func([], [Result], []),
    'ego_canister_list' : IDL.Func([], [Result_4], []),
    'ego_canister_remove' : IDL.Func([IDL.Text, IDL.Principal], [Result], []),
    'ego_canister_track' : IDL.Func([], [Result], []),
    'ego_canister_untrack' : IDL.Func([], [Result], []),
    'ego_canister_upgrade' : IDL.Func([], [Result], []),
    'ego_controller_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_controller_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_controller_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result], []),
    'ego_is_op' : IDL.Func([], [Result_5], ['query']),
    'ego_is_owner' : IDL.Func([], [Result_5], ['query']),
    'ego_is_user' : IDL.Func([], [Result_5], ['query']),
    'ego_log_list' : IDL.Func([IDL.Nat64], [Result_6], ['query']),
    'ego_op_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_op_list' : IDL.Func([], [Result_7], []),
    'ego_op_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_owner_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_owner_add_with_name' : IDL.Func(
        [IDL.Text, IDL.Principal],
        [Result],
        [],
      ),
    'ego_owner_list' : IDL.Func([], [Result_7], []),
    'ego_owner_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_owner_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result], []),
    'ego_user_add' : IDL.Func([IDL.Principal], [Result], []),
    'ego_user_list' : IDL.Func([], [Result_7], []),
    'ego_user_remove' : IDL.Func([IDL.Principal], [Result], []),
    'ego_user_set' : IDL.Func([IDL.Vec(IDL.Principal)], [Result], []),
    'get_blocks_range' : IDL.Func(
        [IDL.Nat64, IDL.Nat64],
        [IDL.Vec(BlockData)],
        ['query'],
      ),
    'get_canister_cycles' : IDL.Func([], [IDL.Nat], ['query']),
    'get_deployed_canisters' : IDL.Func([], [IDL.Opt(DodCanisters)], ['query']),
    'get_dod_canister' : IDL.Func([], [Result_2], ['query']),
    'get_history_miner_candidates' : IDL.Func(
        [IDL.Nat64],
        [Result_8],
        ['query'],
      ),
    'get_last_block' : IDL.Func(
        [],
        [IDL.Opt(IDL.Tuple(IDL.Nat64, BlockData))],
        ['query'],
      ),
    'get_ledger_wasm' : IDL.Func([], [IDL.Opt(IDL.Vec(IDL.Nat8))], ['query']),
    'get_user_detail' : IDL.Func([], [IDL.Opt(UserDetail)], ['query']),
    'get_user_orders_by_blocks' : IDL.Func(
        [IDL.Nat64, IDL.Nat64, UserType],
        [UserBlockOrderRes],
        ['query'],
      ),
    'get_user_subaccount' : IDL.Func(
        [IDL.Principal],
        [IDL.Vec(IDL.Nat8)],
        ['query'],
      ),
    'is_miner' : IDL.Func([IDL.Text], [IDL.Opt(MinerInfo)], ['query']),
    'load_sigs_by_height' : IDL.Func(
        [IDL.Nat64],
        [IDL.Opt(BlockSigs)],
        ['query'],
      ),
    'miner_submit_hash' : IDL.Func([MinerSubmitPayload], [Result_9], []),
    'register' : IDL.Func([IDL.Text, IDL.Text], [Result_10], []),
    'start_generating_blocks' : IDL.Func([], [Result], []),
    'user_put_orders' : IDL.Func([IDL.Nat64], [Result], []),
    'user_register' : IDL.Func([], [Result], []),
    'user_set_burning_rate' : IDL.Func([IDL.Nat], [Result], []),
    'whoAmI' : IDL.Func([], [IDL.Principal], []),
  });
};
export const init = ({ IDL }) => { return []; };
