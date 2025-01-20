import { Triple } from '@bitgo/sdk-core';
import { Descriptor } from '@bitgo/wasm-miniscript';
import { BIP32Interface } from '@bitgo/utxo-lib';

import { DescriptorMap, PsbtParams } from '../../../src/core/descriptor';
import { getKeyTriple, KeyTriple } from '../key.utils';

export function getDefaultXPubs(seed?: string): Triple<string> {
  return getKeyTriple(seed).map((k) => k.neutered().toBase58()) as Triple<string>;
}

function toDescriptorMap(v: Record<string, string>): DescriptorMap {
  return new Map(Object.entries(v).map(([k, v]) => [k, Descriptor.fromString(v, 'derivable')]));
}

export type DescriptorTemplate =
  | 'Wsh2Of3'
  | 'Wsh2Of2'
  /*
   * This is a wrapped segwit 2of3 multisig that also uses a relative locktime with
   * an OP_DROP (requiring a miniscript extension).
   * It is basically what is used in CoreDao staking transactions.
   */
  | 'ShWsh2Of3CltvDrop'
  | 'iBTC';

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

function multi_a(m: number, n: number, keys: BIP32Interface[] | string[], path: string): string {
  if (n < m) {
    throw new Error(`Cannot create ${m} of ${n} multisig`);
  }
  if (keys.length < n) {
    throw new Error(`Not enough keys for ${m} of ${n} multisig: keys.length=${keys.length}`);
  }
  keys = keys.slice(0, n);
  return `multi_a(${m},${keys.map((k) => `${toXPub(k)}/${path}`).join(',')})`;
}

export function getPsbtParams(t: DescriptorTemplate): Partial<PsbtParams> {
  switch (t) {
    case 'Wsh2Of3':
    case 'Wsh2Of2':
      return {};
    case 'ShWsh2Of3CltvDrop':
      return { locktime: 1 };
    case 'iBTC':
      return {};
  }
}

export function getDescriptorString(
  template: DescriptorTemplate,
  keys: KeyTriple | string[] = getDefaultXPubs(),
  path = '0/*'
): string {
  switch (template) {
    case 'Wsh2Of3':
      return `wsh(${multi(2, 3, keys, path)})`;
    case 'ShWsh2Of3CltvDrop':
      const { locktime } = getPsbtParams(template);
      return `sh(wsh(and_v(r:after(${locktime}),${multi(2, 3, keys, path)})))`;
    case 'Wsh2Of2': {
      return `wsh(${multi(2, 2, keys, path)})`;
    }
    case 'iBTC': {
      const tr = `tr(02b733c776dd7776657c20a58f1f009567afc75db226965bce83d5d0afc29e46c9, and_v(v:xpub6C1F2SwADP3TNajQjg2PaniEGpZLvWdMiFP8ChPjQBRWD1XUBeMdE4YkQYvnNhAYGoZKfcQbsRCefserB5DyJM7R9VR6ce6vLrXHVfeqyH3, ${multi_a(
        2,
        3,
        keys,
        path
      )}))`;
      return tr;
    }
  }
  throw new Error(`Unknown descriptor template: ${template}`);
}

export function getDescriptor(
  template: DescriptorTemplate,
  keys: KeyTriple | string[] = getDefaultXPubs(),
  path = '0/*'
): Descriptor {
  return Descriptor.fromString(getDescriptorString(template, keys, path), 'derivable');
}

export function getDescriptorMap(
  template: DescriptorTemplate,
  keys: KeyTriple | string[] = getDefaultXPubs()
): DescriptorMap {
  return toDescriptorMap({
    external: getDescriptor(template, keys, '0/*').toString(),
    internal: getDescriptor(template, keys, '1/*').toString(),
  });
}
