// import logger from '../middleware/logger';
// import { Express, Request, Response } from 'express';
// import {
//   // BroadcastPsbt,
//   GetBalancesREq,
//   InitWalletReq,
//   LoadAccountsReq,
//   RbfReq,
//   RunesBatchMinterReq,
//   TransferToAddressesReq,
//   TransferToIndexesReq,
//   ZipReq,
// } from './types';
// import {
//   createAccountBatch,
//   // broadcastPsbt,
//   createCredential,
//   loadCredential,
//   zip,
// } from '../utils/wallets';
// import { outputWriter } from '../utils/writer';
// import { UTXO } from '@wizz-btc/api';

// /// methods
// export class PostsMethods {
//   static initWallets = 'initWallets';
//   static loadAccounts = 'loadAccounts';
//   static getBalances = 'getBalances';
//   static transferToIndexes = 'transferToIndexes';
//   static transferToAddresses = 'transferToAddresses';
//   static rbf = 'rbf';
//   static runesBatchMinter = 'runesBatchMinter';
//   static zip = 'zip';
//   static broadcastPsbt = 'broadcastPsbt';
// }

// /// enpoints/ apis
// export class Posts {
//   private constructor(public app: Express, public endpont: string) {}

//   static create(app: Express, endpont: string): Posts {
//     return new Posts(app, endpont);
//   }

//   public initWallets(): void {
//     this.app.post(`${this.endpont}/${PostsMethods.initWallets}`, async (req: Request, res: Response) => {
//       try {
//         const { fileName, count, override, phrase, network, path } = req.body as InitWalletReq;
//         const phraseFile = createCredential(fileName, override, phrase);
//         const loadPhrase = loadCredential(fileName);
//         const accountFile = await createAccountBatch(loadPhrase, count, fileName, override, network, path);

//         logger.log('info', `${PostsMethods.initWallets} - phraseFile: ${phraseFile} -  accountFile: ${accountFile}`);
//         res.status(200).send({
//           code: 200,
//           message: {
//             phraseFile,
//             accountFile,
//           },
//           success: true,
//         });
//       } catch (error) {
//         logger.log('error', `${PostsMethods.initWallets} - ${JSON.stringify(error)}`);
//         res.status(200).send({
//           code: 30007,
//           message: 'Failed to initWallets : ' + JSON.stringify(error),
//           success: true,
//         });
//       }
//     });
//   }

//   //
//   // zip file with password
//   //
//   //
//   public zip() {
//     this.app.post(`${this.endpont}/${PostsMethods.zip}`, async (req: Request, res: Response) => {
//       try {
//         const { fileName, password, override, removeFiles } = req.body as ZipReq;
//         const zipFile = await zip(fileName, password, override, removeFiles);

//         logger.log('info', `${PostsMethods.zip} - phraseFile: ${fileName}`);
//         res.status(200).send({
//           code: 200,
//           message: {
//             zipFile,
//           },
//           success: true,
//         });
//       } catch (error) {
//         logger.log('error', `${PostsMethods.zip} - ${JSON.stringify(error)}`);
//         res.status(200).send({
//           code: 30007,
//           message: 'Failed to zip : ' + JSON.stringify(error),
//           success: true,
//         });
//       }
//     });
//   }
// }
