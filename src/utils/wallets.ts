/* eslint-disable @typescript-eslint/no-var-requires */
import { detectAddressTypeToScripthash, getKeypairInfo, Network, toXOnly } from '@wizz-js/utils';
import {
  ElectrumApi,
  MAINNET_ATOMICALS_ENDOINT,
  MAINNET_MEMPOOL_ENDPOINT,
  MempoolApi,
  TESTNET_ATOMICALS_ENDOINT,
  TESTNET_MEMPOOL_ENDPOINT,
  UTXO,
} from '@wizz-btc/api';
import { buildTx, calcFee, DUST_AMOUNT, getAddressType, toPsbt, TxOk } from '@wizz-btc/wallet';
import * as bip39 from 'bip39';
import fs from 'fs';
import archiver from 'archiver';
// import { detectAddressTypeToScripthash } from '@wizz-btc/wallet';
import { credentialFolder, defaultPath } from './constant';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import ECPairFactory from 'ecpair';
import BIP32Factory from 'bip32';
import { to } from 'await-to-js';
import config from '../config/config';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);
archiver.registerFormat('zip-encryptable', require('archiver-zip-encryptable'));

export const createKeyPair = async (phrase: string, path = "m/44'/0'/0'/0/0", network: Network) => {
  const seed = await bip39.mnemonicToSeed(phrase);
  const rootKey = bip32.fromSeed(seed, network);
  const childNodePrimary = rootKey.derivePath(path);
  // const p2pkh = bitcoin.payments.p2pkh({ pubkey: childNodePrimary.publicKey });
  const childNodeXOnlyPubkeyPrimary = toXOnly(childNodePrimary.publicKey);
  const p2trPrimary = bitcoin.payments.p2tr({
    internalPubkey: childNodeXOnlyPubkeyPrimary,
    network,
  });
  if (!p2trPrimary.address || !p2trPrimary.output) {
    throw 'error creating p2tr';
  }
  // Used for signing, since the output and address are using a tweaked key
  // We must tweak the signer in the same way.
  childNodePrimary.tweak(bitcoin.crypto.taggedHash('TapTweak', childNodeXOnlyPubkeyPrimary));

  // Do a sanity check with the WIF serialized and then verify childNodePrimary is the same
  const wif = childNodePrimary.toWIF();
  const keypair = ECPair.fromWIF(wif, network);

  if (childNodePrimary.publicKey.toString('hex') !== keypair.publicKey.toString('hex')) {
    throw 'createKeyPair error child node not match sanity check';
  }
  return {
    address: p2trPrimary.address,
    publicKey: childNodePrimary.publicKey.toString('hex'),
    publicKeyXOnly: childNodeXOnlyPubkeyPrimary.toString('hex'),
    path,
    WIF: childNodePrimary.toWIF(),
    privateKey: childNodePrimary.privateKey?.toString('hex'),
    // tweakedChildNode: tweakedChildNodePrimary
  };
};

export interface IAccountFile {
  index: number;
  address: string;
  publicKey: string;
  publicKeyXOnly: string;
  path: string;
  WIF: string;
  privateKey: string;
}

export function createCredential(fileName: string, override = false, phrase?: string): string {
  try {
    const _actualFile = credentialFolder + fileName + '.txt';
    const found = override ? false : fs.existsSync(_actualFile);
    if (found) {
      new Error(`${fileName} exist, you can override = true`);
    } else {
      const _phrase = phrase ?? bip39.generateMnemonic(128);
      if (!bip39.validateMnemonic(_phrase)) {
        throw new Error('Unknown phrase');
      }
      if (!fs.existsSync(_actualFile)) {
        fs.mkdirSync(credentialFolder, { recursive: true });
      }
      fs.writeFileSync(_actualFile, _phrase);
      return _actualFile;
    }
  } catch (error) {
    throw 'Error: createCredential failed: ' + `${(error as Error).message}`;
  }
}

export function loadCredential(fileName: string): string {
  try {
    const _actualFile = credentialFolder + fileName + '.txt';
    const phrase = fs.readFileSync(_actualFile, { encoding: 'utf-8' });
    if (!bip39.validateMnemonic(phrase)) {
      throw new Error('Unknown phrase');
    }
    return phrase;
  } catch (error) {
    throw 'Error: loadCredential failed: ' + `${(error as Error).message}`;
  }
}

export async function createAccountBatch(
  phrase: string,
  count: number,
  fileName: string,
  override = false,
  network = 'mainnet',
  path = defaultPath,
): Promise<string> {
  try {
    const _actualFile = credentialFolder + fileName + '.json';
    const found = override ? false : fs.existsSync(_actualFile);
    if (found) {
      throw new Error(`${fileName} exist, you can override = true`);
    } else {
      const kps: IAccountFile[] = [];
      for (let index = 0; index < count; index += 1) {
        const btcNetwork = network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
        const kp = await createKeyPair(phrase, (path || defaultPath) + '/' + index, btcNetwork);
        const kp2 = getKeypairInfo(ECPair.fromWIF(kp.WIF, btcNetwork), btcNetwork);
        kps.push({ index, ...kp, address: kp2.address });
      }
      fs.writeFileSync(_actualFile, JSON.stringify(kps));
      return _actualFile;
    }
  } catch (error) {
    throw 'Error: createAccountBatch failed: ' + `${(error as Error).message}`;
  }
}

export async function loadAccountBatch(fileName: string, addressOnly = true): Promise<Partial<IAccountFile>[]> {
  try {
    const _actualFile = credentialFolder + fileName + '.json';
    const found = fs.existsSync(_actualFile);
    if (!found) {
      throw new Error(`${fileName} not exist, you can create one`);
    } else {
      const theFile = fs.readFileSync(_actualFile, { encoding: 'utf-8' });
      const json = JSON.parse(theFile) as IAccountFile[];
      if (addressOnly) {
        return json.map(j => ({ index: j.index, address: j.address }));
      } else {
        return json;
      }
    }
  } catch (error) {
    throw 'Error: loadAccountBatch failed: ' + `${(error as Error).message}`;
  }
}

export async function zip(fileName: string, password: string, override = false, removeFiles = false) {
  try {
    const zipFile = credentialFolder + fileName + '.zip';
    const found = override ? false : fs.existsSync(zipFile);
    if (found) {
      throw new Error(`${fileName} exist, you can override = true`);
    } else {
      if (fs.existsSync(zipFile)) {
        fs.rmSync(zipFile);
      }
      const output = fs.createWriteStream(zipFile);
      const archive = archiver(
        'zip-encryptable' as archiver.Format,
        {
          zlib: { level: 9 },
          forceLocalTime: true,
          password,
        } as archiver.ArchiverOptions,
      );
      archive.pipe(output);

      const _actualFile = credentialFolder + fileName + '.txt';
      if (!fs.existsSync(_actualFile)) {
        throw new Error(`${_actualFile} not exist, you must create one`);
      }
      const phrase = fs.readFileSync(_actualFile, { encoding: 'utf-8' });

      const _jsonFile = credentialFolder + fileName + '.json';
      if (!fs.existsSync(_jsonFile)) {
        throw new Error(`${_jsonFile} not exist, you must create one`);
      }
      const json = fs.readFileSync(_jsonFile, { encoding: 'utf-8' });

      archive.append(Buffer.from(phrase), { name: fileName + '.txt' });
      archive.append(Buffer.from(json), { name: fileName + '.json' });
      await archive.finalize();
      if (fs.existsSync(zipFile) && removeFiles) {
        fs.rmSync(_actualFile);
        fs.rmSync(_jsonFile);
      }
    }

    return zipFile;
  } catch (error) {
    throw 'Error: zip failed: ' + `${(error as Error).message}`;
  }
}
