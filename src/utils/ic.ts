import { Actor, ActorSubclass, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { SignIdentity } from '@dfinity/agent';
import { InterfaceFactory } from '@dfinity/candid/lib/cjs/idl';

export interface CreateActorResult<T> {
  actor: ActorSubclass<T>;
  agent: HttpAgent;
}

export async function _createActor<T>(
  interfaceFactory: InterfaceFactory,
  canisterId: string,
  identity?: SignIdentity,
): Promise<CreateActorResult<T>> {
  const agent = HttpAgent.createSync({
    identity,
    host: 'https://icp-api.io/',
  });
  // Only fetch the root key when we're not in prod
  if (process.env.DFX_NETWORK !== 'ic') {
    await agent.fetchRootKey();
  }

  const actor = Actor.createActor<T>(interfaceFactory, {
    agent,
    canisterId: canisterId === '' ? Principal.fromText('aaaaa-aa') : canisterId,
  });
  return { actor, agent };
}
