import * as assert from 'assert';

import { parseDescriptor, DescriptorBuilder, getDescriptorFromBuilder } from '../../src/descriptor/builder';
import { getKeyTriple } from '../core/key.utils';

function getDescriptorBuilderForType(name: DescriptorBuilder['name']): DescriptorBuilder {
  const keys = getKeyTriple().map((k) => k.neutered());
  switch (name) {
    case 'Wsh2Of2':
    case 'Wsh2Of3':
    case 'iBTC':
      return {
        name,
        keys: keys.slice(0, ['Wsh2Of3', 'iBTC'].includes(name) ? 3 : 2),
        path: '0/*',
      };
    case 'Wsh2Of3CltvDrop':
    case 'ShWsh2Of3CltvDrop':
      return {
        name,
        keys,
        path: '0/*',
        locktime: 1,
      };
  }
}

function describeForName(n: DescriptorBuilder['name']) {
  describe(`DescriptorBuilder ${n}`, () => {
    it('parses descriptor template', () => {
      const builder = getDescriptorBuilderForType(n);
      const descriptor = getDescriptorFromBuilder(builder);
      assert.deepStrictEqual(builder, parseDescriptor(descriptor));
    });
  });
}

describeForName('Wsh2Of2');
describeForName('Wsh2Of3');
describeForName('Wsh2Of3CltvDrop');
describeForName('ShWsh2Of3CltvDrop');
