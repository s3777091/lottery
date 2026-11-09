const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('admin renders fixed two-decimal comma odds, independent of browser locale', () => {
  const source = fs.readFileSync('src/app/admin/page.tsx', 'utf8');
  assert.ok(source.includes("defaultValue={g.percent.toFixed(2).replace('.', ',')}"));
  assert.ok(!source.includes('toFixed(10)'));
  assert.ok(source.includes('inputMode="decimal"'));
  for (const [value, expected] of [[7.27650727, '7,28'], [15, '15,00'], [0, '0,00'], [100, '100,00']]) {
    assert.equal(value.toFixed(2).replace('.', ','), expected);
  }
});

test('admin describes current penalty schedule rather than the old one', () => {
  const source = fs.readFileSync('src/app/admin/page.tsx', 'utf8');
  for (const value of ['40,00%', '6,00%', '0,15%', '0,01%']) assert.ok(source.includes(value));
  assert.ok(!source.includes('giảm trọng số 30%'));
});
