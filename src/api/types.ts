import { RuneSettings } from '../utils/runes';

export interface InitWalletReq {
  fileName: string;
  path?: string;
  phrase?: string;
  count: number;
  override?: boolean;
  network?: string;
}

export interface ZipReq {
  fileName: string;
  password: string;
  override?: boolean;
  removeFiles?: boolean;
}

export interface LoadAccountsReq {
  fileName: string;
  addressOnly?: boolean;
}

export interface GetBalancesREq {
  fileName: string;
  start?: number;
  end?: number;
  network?: string;
}

export interface TransferToIndexesReq {
  fileName: string;
  from: string;
  start: number;
  end: number;
  perAmount: number;
  rbfAmount?: number;
  feeRate: number;
  network?: string;
  preview?: boolean;
}

export interface RbfReq {
  fileName: string;
  start: number;
  end: number;
  network?: string;
  preview?: boolean;
}

export interface TransferToAddressesReq {
  fileName: string;
  from: string;
  addresses: string[];
  perAmount: number;
  feeRate: number;
  network?: string;
}

export interface RunesBatchMinterReq {
  fileName: string;
  start: number;
  end: number;
  feeRate: number;
  runeSettings: RuneSettings;
  mint_to?: string;
  network?: string;
}

export interface BroadcastPsbt {
  label?: string;
  base64: string;
  network?: string;
}
