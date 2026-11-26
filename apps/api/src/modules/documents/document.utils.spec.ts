import { applyEdits } from './document.utils.js';

/** The error body applyEdits throws for a bad edit. */
const mismatchOf = async (run: () => string) => {
  try {
    run();
  } catch (error) {
    return (error as { res: Response }).res.json();
  }
  throw new Error('applyEdits did not throw');
};

describe('applyEdits', () => {
  it('swaps each old text once and leaves the rest', () => {
    expect(
      applyEdits('a b c', [
        { old: 'a', new: 'x' },
        { old: 'c', new: 'z' },
      ]),
    ).toBe('x b z');
  });

  it('applies edits in order, each seeing the earlier result', () => {
    expect(
      applyEdits('one', [
        { old: 'one', new: 'two' },
        { old: 'two', new: 'three' },
      ]),
    ).toBe('three');
  });

  it('lets new be empty to delete text', () => {
    expect(applyEdits('keep drop', [{ old: ' drop', new: '' }])).toBe('keep');
  });

  it('inserts new literally, with $ patterns untouched', () => {
    expect(applyEdits('price X', [{ old: 'X', new: "$& $1 $$ $'" }])).toBe(
      "price $& $1 $$ $'",
    );
  });

  it('matches case and whitespace exactly', async () => {
    expect(
      await mismatchOf(() => applyEdits('Hello', [{ old: 'hello', new: 'x' }])),
    ).toMatchObject({ code: 'edit_mismatch', message: /Edit 1.*0 times/ });
    expect(
      await mismatchOf(() => applyEdits('a  b', [{ old: 'a b', new: 'x' }])),
    ).toMatchObject({ code: 'edit_mismatch', message: /Edit 1.*0 times/ });
  });

  it('names the edit and the match count when old occurs twice', async () => {
    expect(
      await mismatchOf(() =>
        applyEdits('aa bb aa', [
          { old: 'bb', new: 'x' },
          { old: 'aa', new: 'y' },
        ]),
      ),
    ).toMatchObject({ code: 'edit_mismatch', message: /Edit 2.*2 times/ });
  });

  it('counts overlapping matches', async () => {
    expect(
      await mismatchOf(() => applyEdits('aaa', [{ old: 'aa', new: 'x' }])),
    ).toMatchObject({ message: /2 times/ });
  });
});
