import { canonicalJson, documentHash } from './canonical-document';

describe('canonical document hashing', () => {
  it('produces the same hash regardless of object key order', () => {
    const left = { title: 'Report', data: { b: 2, a: 1 } };
    const right = { data: { a: 1, b: 2 }, title: 'Report' };
    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(documentHash(left)).toBe(documentHash(right));
  });

  it('changes the hash when document content changes', () => {
    expect(documentHash({ value: 1 })).not.toBe(documentHash({ value: 2 }));
  });
});
