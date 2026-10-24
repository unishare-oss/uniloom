import { createHmac } from 'node:crypto';
import { findKeys, verifySignature } from './github.utils.js';

const sign = (body: string, secret: string) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('verifySignature', () => {
  const body = '{"action":"opened"}';

  it('accepts the HMAC of the exact body', () => {
    expect(verifySignature(body, sign(body, 's3cret'), 's3cret')).toBe(true);
  });

  it('rejects a missing, wrong, altered or short signature', () => {
    expect(verifySignature(body, undefined, 's3cret')).toBe(false);
    expect(verifySignature(body, sign(body, 'other'), 's3cret')).toBe(false);
    expect(verifySignature(`${body} `, sign(body, 's3cret'), 's3cret')).toBe(
      false,
    );
    expect(verifySignature(body, 'sha256=abc', 's3cret')).toBe(false);
  });
});

describe('findKeys', () => {
  const prefixes = ['UN', 'TG'];

  it('finds a key and does not call a plain mention closing', () => {
    expect(findKeys('Related to UN-42', prefixes)).toEqual([
      { key: 'UN-42', closes: false },
    ]);
  });

  it('counts closing words, also with a Markdown link', () => {
    expect(findKeys('Closes UN-1\nfixes: TG-2', prefixes)).toEqual([
      { key: 'UN-1', closes: true },
      { key: 'TG-2', closes: true },
    ]);
    expect(
      findKeys('Closes [UN-42](https://example.com/UN-42)', prefixes),
    ).toEqual([{ key: 'UN-42', closes: true }]);
  });

  it('matches a branch name in any letter case', () => {
    expect(findKeys('feat/un-42-fix-login', prefixes)).toEqual([
      { key: 'UN-42', closes: false },
    ]);
  });

  it('ignores other prefixes and joins a key said twice', () => {
    expect(findKeys('ABC-1 and UN-5, closes UN-5', prefixes)).toEqual([
      { key: 'UN-5', closes: true },
    ]);
    expect(findKeys('nothing here', prefixes)).toEqual([]);
  });
});
