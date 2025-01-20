import { BIP32Interface } from '@bitgo/utxo-lib';
import { Descriptor } from '@bitgo/wasm-miniscript';

type DescriptorWithKeys<TName extends string> = {
  name: TName;
  keys: BIP32Interface[];
  path: string;
};

export type DescriptorBuilder =
  | DescriptorWithKeys<'Wsh2Of2'>
  | DescriptorWithKeys<'Wsh2Of3'>
  /*
   * This is a segwit (wrapped or native) 2of3 multisig that also uses a
   * relative locktime with an OP_DROP (requiring a miniscript extension).
   * It is basically what is used in CoreDao staking transactions.
   */
  | (DescriptorWithKeys<'ShWsh2Of3CltvDrop' | 'Wsh2Of3CltvDrop'> & { locktime: number })
  | DescriptorWithKeys<'iBTC'>;

function toXPub(k: BIP32Interface | string): string {
  if (typeof k === 'string') {
    return k;
  }
  return k.neutered().toBase58();
}

function multi(m: number, n: number, keys: BIP32Interface[] | string[], path: string): string {
  if (n < m) {
    throw new Error(`Cannot create ${m} of ${n} multisig`);
  }
  if (keys.length < n) {
    throw new Error(`Not enough keys for ${m} of ${n} multisig: keys.length=${keys.length}`);
  }
  keys = keys.slice(0, n);
  return `multi(${m},${keys.map((k) => `${toXPub(k)}/${path}`).join(',')})`;
}

function iBTCMulti(m: number, n: number, keys: BIP32Interface[] | string[], path: string): string {
  if (n < m) {
    throw new Error(`Cannot create ${m} of ${n} multisig`);
  }
  if (keys.length < n) {
    throw new Error(`Not enough keys for ${m} of ${n} multisig: keys.length=${keys.length}`);
  }
  keys = keys.slice(0, n);

  return `multi_a(${m},${keys
    .map((k) => `${toXPub(k)}/${path}`)
    .sort((a, b) => (a > b ? 1 : -1))
    .join(',')})`;
}

function getDescriptorString(builder: DescriptorBuilder): string {
  switch (builder.name) {
    case 'Wsh2Of3':
      return `wsh(${multi(2, 3, builder.keys, builder.path)})`;
    case 'Wsh2Of2':
      return `wsh(${multi(2, 2, builder.keys, builder.path)})`;
    case 'Wsh2Of3CltvDrop':
      return `wsh(and_v(r:after(${builder.locktime}),${multi(2, 3, builder.keys, builder.path)}))`;
    case 'ShWsh2Of3CltvDrop':
      return `sh(${getDescriptorString({ ...builder, name: 'Wsh2Of3CltvDrop' })})`;
    case 'iBTC':
      // TODO:
      // The first key represents the unspendable public key, unique to each iBTC vault. This should be provided as an argument for each Descriptor Wallet Generation.
      // The second key is the Attestor Group Public Key, shared across all iBTC vaults, but it should also be passed as an argument for each Descriptor Wallet Generation.
      // The keys within the multi_a are the BitGo-related keys (user key, backup key, and BitGo key), organized as a sorted array, as seen in the iBTCMulti function.
      return `tr(025e2fe93382caa3a091fa835244279f1ad53d63612cfe294d07c7e40884d4c307,and_v(v:pk(02c958ef20bc29e98e1ae2cee68cacb65be000f518c0110f2b6e9eabdb172ad56e),${iBTCMulti(
        2,
        3,
        builder.keys,
        builder.path
      )}))`;
  }
  throw new Error(`Unknown descriptor template: ${builder}`);
}

export function getDescriptorFromBuilder(builder: DescriptorBuilder): Descriptor {
  const descriptorString = getDescriptorString(builder);
  console.log('descriptor string:', descriptorString);
  return Descriptor.fromString(getDescriptorString(builder), 'derivable');
}
