import assert from 'assert';

import { assertHasValidSignature, createNamedDescriptorWithSignature } from '../../src/descriptor/NamedDescriptor';
import { getKeyTriple } from '../core/key.utils';
import { getDescriptorFromBuilder } from '../../src/descriptor/builder';
import { getFixture } from '../core/fixtures.utils';

describe('NamedDescriptor', function () {
  it('creates named descriptor with signature', async function () {
    const keys = getKeyTriple();
    const namedDescriptor = createNamedDescriptorWithSignature(
      'foo',
      getDescriptorFromBuilder({ name: 'Wsh2Of2', keys, path: '0/*' }),
      keys[0]
    );
    assert.deepStrictEqual(
      await getFixture(__dirname + '/fixtures/NamedDescriptorWithSignature.json', namedDescriptor),
      namedDescriptor
    );
    assertHasValidSignature(namedDescriptor, keys[0]);
  });
});