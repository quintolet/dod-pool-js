// import { Ed25519KeyIdentity } from '@dfinity/identity-secp256k1';

// import '@btckit/types';
import { _createActor, handleDelegation } from './baseConnection';
import { idlFactory as verifierIDL } from './idls/ic_siwb_provider.idl';
import { SignedDelegation, _SERVICE as verifierService, LoginDetails } from './idls/ic_siwb_provider';
import { getUserDetail, hasOwnProperty, registerUser } from './dod';
// import { Principal } from '@dfinity/principal';
import { ActorSubclass, SignIdentity } from '@dfinity/agent';
// import { KEY_ICSTORAGE_DELEGATION, KEY_ICSTORAGE_KEY, _deleteStorage, storage } from './storage';

import { DelegationChain, DelegationIdentity, Ed25519KeyIdentity, isDelegationValid } from '@dfinity/identity';

import { Principal } from '@dfinity/principal';
import { toHexString } from '@dfinity/candid';
import config from '../config/config';
import { deleteStorage, loadDelegationChain, loadSessionId, saveDelegationChain, saveSessionId } from './storage';
import { ECPairInterface } from './bitcoin';
import { signMessageOfECDSA } from '../message/dEcdsa';

const IC_SIWB_CANISTERID = config.siwb_canister;

export interface BaseBalance {
  confirmed: number;
  unconfirmed: number;
  total: number;
}

export interface InscriptionDetail {
  inscriptionId: string;
  inscriptionNumber: number;
  address: string;
  content: string;
  content_length: number;
  content_type: string;
  genesis_transaction: string;
  location: string;
  offset: number;
  output: string;
  output_value: number;
  preview: string;
  timestamp: number;
}

export interface SiwbInterface {
  isReady: () => boolean;
  init: () => Promise<void>;
  getPrincipal: () => any;
}

// export function dectectBrowserInject(): SiwbWalletType {
//   if (typeof window.unisat !== 'undefined') {
//     return SiwbWalletType.Unisat;
//   } else if (typeof window.btc !== 'undefined') {
//     return SiwbWalletType.Btc;
//   } else if (typeof window.wizz !== 'undefined') {
//     return SiwbWalletType.Wizz;
//   } else {
//     return SiwbWalletType.NotFound;
//   }
// }

export class SiwbConnector {
  constructor(private delegationIdentity: DelegationIdentity, private publicKey: string, private userAddress: string) {}

  static async connect(ecpair: ECPairInterface, address: string) {
    // let key: null | SignIdentity = null;

    // const maybeIdentityStorage = loadSessionId();

    // if (maybeIdentityStorage) {
    //   try {
    //     key = Ed25519KeyIdentity.fromJSON(maybeIdentityStorage) as unknown as SignIdentity;
    //   } catch (e) {
    //     // Ignore this, this means that the ICStorage value isn't a valid Ed25519KeyIdentity
    //     // serialization.
    //   }
    // }

    // let chain: null | DelegationChain = null;
    // let delegationTargets: string[] = [];
    let delegationIdentityK: DelegationIdentity | undefined = undefined;

    // if (key) {
    //   try {
    //     const chainStorage = loadDelegationChain();

    //     if (chainStorage) {
    //       chain = DelegationChain.fromJSON(chainStorage);

    //       chain.delegations.forEach(signedDelegation => {
    //         const targets =
    //           signedDelegation.delegation.targets && signedDelegation.delegation.targets.length > 0 ? signedDelegation.delegation.targets : undefined;
    //         if (targets) {
    //           delegationTargets = [...new Set(delegationTargets.concat(targets.map(e => e.toText())))];
    //         }
    //       });
    //       // Verify that the delegation isn't expired.
    //       if (!isDelegationValid(chain)) {
    //         deleteStorage();
    //         key = null;
    //       } else {
    //         delegationIdentityK = DelegationIdentity.fromDelegation(key, chain);
    //       }
    //     }
    //   } catch (e) {
    //     console.error(e);
    //     // If there was a problem loading the chain, delete the key.
    //     deleteStorage();
    //     key = null;
    //   }
    // }

    const sessionId = Ed25519KeyIdentity.generate();

    // if (!key) {
    //   saveSessionId(JSON.stringify(sessionId));
    // }
    // sessionId save to localstorage

    const verifierActor = await _createActor<verifierService>(
      verifierIDL,
      IC_SIWB_CANISTERID,
      delegationIdentityK ?? (sessionId as unknown as SignIdentity),
    );

    const currentAccount = address;
    const public_key = ecpair.publicKey.toString('hex');

    if (delegationIdentityK === undefined) {
      const messageRes = await verifierActor.actor.siwb_prepare_login(currentAccount);
      let message: string;
      if (hasOwnProperty(messageRes, 'Ok')) {
        message = messageRes.Ok as string;
      } else {
        throw new Error(messageRes['Err']);
      }
      const signature = signMessageOfECDSA(ecpair, message) as string;
      const { delegationIdentity, delegationChain } = await handleDelegationVerification(
        verifierActor.actor,
        currentAccount,
        sessionId as unknown as SignIdentity,
        public_key,
        signature,
      );
      delegationIdentityK = delegationIdentity;
    }

    // if (delegationIdentityK && !delegationIdentityK.getPrincipal().isAnonymous()) {
    //   const detail = await getUserDetail(delegationIdentityK);
    //   if (detail.length === 0) {
    //     await registerUser(delegationIdentityK);
    //   }
    // }
    // delegationChain save to localstorage
    return new SiwbConnector(delegationIdentityK, public_key, currentAccount);
  }

  public static disconnect() {
    deleteStorage();
  }

  public static hasStorage(): boolean {
    return !!loadDelegationChain();
  }

  public getPrincipal(): Principal {
    return this.delegationIdentity.getPrincipal();
  }

  public getAddress(): string {
    return this.userAddress;
  }

  public getIdentity() {
    return this.delegationIdentity;
  }

  // public static async getDelegationIdentity() {
  //   let key: null | SignIdentity = null;

  //   const maybeIdentityStorage = loadSessionId();

  //   if (maybeIdentityStorage) {
  //     try {
  //       key = Ed25519KeyIdentity.fromJSON(maybeIdentityStorage) as unknown as SignIdentity;
  //     } catch (e) {
  //       // Ignore this, this means that the ICStorage value isn't a valid Ed25519KeyIdentity
  //       // serialization.
  //     }
  //   }

  //   let chain: null | DelegationChain = null;
  //   let delegationTargets: string[] = [];
  //   let delegationIdentityK: DelegationIdentity | undefined = undefined;

  //   if (key) {
  //     try {
  //       const chainStorage = loadDelegationChain();

  //       if (chainStorage) {
  //         chain = DelegationChain.fromJSON(chainStorage);

  //         chain.delegations.forEach(signedDelegation => {
  //           const targets =
  //             signedDelegation.delegation.targets && signedDelegation.delegation.targets.length > 0 ? signedDelegation.delegation.targets : undefined;
  //           if (targets) {
  //             delegationTargets = [...new Set(delegationTargets.concat(targets.map(e => e.toText())))];
  //           }
  //         });
  //         // Verify that the delegation isn't expired.
  //         if (!isDelegationValid(chain)) {
  //           deleteStorage();
  //           key = null;
  //         } else {
  //           delegationIdentityK = DelegationIdentity.fromDelegation(key, chain);
  //         }
  //       }
  //     } catch (e) {
  //       console.error(e);
  //       // If there was a problem loading the chain, delete the key.
  //       deleteStorage();
  //       key = null;
  //     }
  //   }
  //   return delegationIdentityK;
  // }
}

export async function handleDelegationVerification(
  actor: ActorSubclass<verifierService>,
  address: string,
  sessionId: SignIdentity,
  public_key: string,
  signature: string,
): Promise<{ delegationIdentity: DelegationIdentity; delegationChain: DelegationChain }> {
  const session_key = Array.from(new Uint8Array(sessionId.getPublicKey().toDer()));
  const result = await actor.siwb_login(signature, address, public_key, session_key, { ECDSA: null });

  // new SiwbConnector();
  // const result = verifyMessage(publicKey, sig, message);
  if (hasOwnProperty(result, 'Ok')) {
    const { expiration, user_canister_pubkey } = result.Ok as LoginDetails;

    const res = await actor.siwb_get_delegation(address, session_key, expiration);

    if (res && hasOwnProperty(res, 'Ok')) {
      const signed_delegation = res.Ok as SignedDelegation;
      const targets = signed_delegation.delegation.targets.length > 0 ? signed_delegation.delegation.targets[0] : undefined;
      const s = {
        delegation: {
          pubkey: Uint8Array.from(signed_delegation.delegation.pubkey),
          expiration: BigInt(signed_delegation.delegation.expiration),
          targets: targets && targets.length > 0 ? targets : undefined,
        },
        signature: Uint8Array.from(signed_delegation.signature),
        userKey: user_canister_pubkey,
        timestamp: expiration,
      };
      const delegationResult = {
        kind: 'success',
        delegations: [s],
        userPublicKey: Uint8Array.from(s.userKey),
      };
      return await handleDelegation(delegationResult, sessionId);
    } else {
      throw new Error('No signed delegation found');
    }
  } else {
    throw new Error(result.Err as string);
  }
}
