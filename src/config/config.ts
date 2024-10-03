import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

const config = {
  node_env: process.env.NODE_ENV,
  port: process.env.NODE_PORT,
  cors_origin: process.env.CORS_ORIGIN,
  siwb_canister: process.env.SIWB_CANISTERID,
  dod_canister: process.env.DOD_CANISTERID,
};

export default config;
