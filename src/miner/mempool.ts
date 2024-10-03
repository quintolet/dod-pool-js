import { Network } from 'bitcoinjs-lib';
import { bitcoin } from './bitcoin';

function isTestnet(network: Network) {
  return network === bitcoin.networks.testnet;
}

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
}

function mempoolUrl(networks: Network) {
  return isTestnet(networks) ? 'https://mempool.space/testnet4/api' : 'https://mempool.space/api';
}

export function getUTXOs(address: string, network: Network = bitcoin.networks.testnet, includeUnconfirmed = false) {
  const url = mempoolUrl(network);
  return fetch(`${url}/address/${address}/utxo`)
    .then(res => res.json())
    .then((v: UTXO[]) =>
      v
        .filter((e: any) => e.status.confirmed || includeUnconfirmed)
        .map(e => {
          delete (e as any).status;
          return e;
        })
        .sort((a, b) => b.value - a.value),
    );
}

export function getTx(txid: string, network: Network = bitcoin.networks.testnet) {
  const url = mempoolUrl(network);
  return fetch(`${url}/tx/${txid}`)
    .then(res => res.json())
    .then(hex => hex);
}

export function getTxBytes(txid: string, network: Network = bitcoin.networks.testnet) {
  const url = mempoolUrl(network);
  return fetch(`${url}/tx/${txid}/hex`)
    .then(res => res.text())
    .then(hex => hex);
}

export function getBlocks(blockHeight: number, network: Network = bitcoin.networks.testnet) {
  const url = mempoolUrl(network);
  return fetch(`${url}/v1/blocks/${blockHeight}`)
    .then(res => res.json())
    .then(hex => hex);
}

export function getTxBytesMerkleProof(txid: string, network: Network = bitcoin.networks.testnet): Promise<MempoolMerkleProof> {
  const url = mempoolUrl(network);
  return fetch(`${url}/tx/${txid}/merkle-proof`).then(res => res.json() as Promise<MempoolMerkleProof>);
}

export function getTipHeight(network: Network = bitcoin.networks.testnet) {
  const url = mempoolUrl(network);
  return fetch(`${url}/blocks/tip/height`).then(res => res.text() as Promise<string>);
}

export interface MempoolMerkleProof {
  pos: number;
  merkle: string[];
  block_height: number;
}

export function pickUTXO(utxos: UTXO[], expectAmount: number): UTXO | undefined {
  let pick: UTXO | undefined;
  for (const utxo of utxos) {
    if (utxo.value >= expectAmount) {
      pick = utxo;
      break;
    }
  }
  return pick;
}

export function broadcast(rawhex: string, network: Network) {
  const url = mempoolUrl(network);
  return fetch(`${url}/tx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: rawhex,
  }).then(response => response.text());
}
