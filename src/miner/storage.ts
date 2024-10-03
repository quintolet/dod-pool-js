import fs from 'fs';
export const credentialFolder = './credentials';

export const loadSessionId = (): string | undefined => {
  if (fs.existsSync(credentialFolder + '/session-id.json')) {
    return fs.readFileSync(credentialFolder + '/session-id.json', 'utf8');
  } else {
    return undefined;
  }
};

export const loadDelegationChain = (): string | undefined => {
  if (fs.existsSync(credentialFolder + '/delegation-chain.json')) {
    return fs.readFileSync(credentialFolder + '/delegation-chain.json', 'utf8');
  } else {
    return undefined;
  }
};

export const saveSessionId = (sessionId: string): void => {
  fs.writeFileSync(credentialFolder + '/session-id.json', sessionId);
};

export const saveDelegationChain = (delegationChain: string): void => {
  fs.writeFileSync(credentialFolder + '/delegation-chain.json', delegationChain);
};

export const deleteStorage = () => {
  fs.rmSync(credentialFolder + '/delegation-chain.json');
  fs.rmSync(credentialFolder + '/session-id.json');
};

export const loadWif = () => {};
