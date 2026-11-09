const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('src/lib/eligibility.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function('exports', 'require', 'module', compiled)(loaded.exports, require, loaded);
const { departmentChances, selectDepartment, rebalanceDepartment, eligiblePeople, DRAW_TICKETS } = loaded.exports;
const { selectWinner } = loaded.exports;
const state = () => ({
  people: Array.from({ length: 60 }, (_, i) => ({ id: String(i), department: ['A', 'B', 'C'][Math.floor(i / 20)] })),
  winners: [], excluded: [], settings: { departmentWeights: { a: 10, b: 40, c: 50 } },
});

test('five never-winning teams each receive the entire five removed weight units', () => {
  const s = {people: [], winners: [], excluded: [], settings: {departmentWeights: {}}};
  for (let i = 0; i < 6; i++) {
    s.settings.departmentWeights[`t${i}`] = 25 / 3;
    for (let j = 0; j < 3; j++) s.people.push({id: `${i}-${j}`, department: `T${i}`});
  }
  s.winners.push({personId: '0-0', department: 'T0'});
  const rows = departmentChances(s);
  assert.ok(Math.abs(rows[0].weight - 10 / 3) < 1e-12);
  for (const row of rows.slice(1)) assert.ok(Math.abs(row.weight - (25 / 3 + 5)) < 1e-12);
  assert.equal(rows.reduce((sum, row) => sum + row.tickets, 0), DRAW_TICKETS);
});

test('penalty redistributes probability to all other teams without coarse rounding', () => {
  const s = state();
  s.winners.push({ personId: '0', department: 'A' });
  const rows = departmentChances(s);
  assert.equal(rows.reduce((sum, g) => sum + g.tickets, 0), DRAW_TICKETS);
  const expected = [4 / 106, 46 / 106, 56 / 106];
  rows.forEach((g, i) => assert.ok(Math.abs(g.tickets / DRAW_TICKETS - expected[i]) < 1 / DRAW_TICKETS));
  assert.ok(rows[1].percent > 40 && rows[2].percent > 50);
  let start = 0;
  for (const row of rows) {
    assert.equal(selectDepartment(rows, start).key, row.key);
    assert.equal(selectDepartment(rows, start + row.tickets - 1).key, row.key);
    start += row.tickets;
  }
});

test('tiny positive odds survive; zero odds have no tickets', () => {
  const s = state();
  s.settings.departmentWeights = { a: 0.000001, b: 0, c: 99.999999 };
  const rows = departmentChances(s);
  assert.equal(rows[0].tickets, 10000);
  assert.equal(rows[1].tickets, 0);
  assert.equal(selectDepartment(rows, 10000).key, 'c');
});

test('editing actual odds after a win does not apply penalty twice', () => {
  const s = state();
  s.winners.push({ personId: '0', department: 'A' });
  s.settings.departmentWeights = rebalanceDepartment(departmentChances(s), 'a', 12.345678);
  assert.ok(Math.abs(departmentChances(s)[0].percent - 12.345678) < 1e-9);
});

test('no total or department cap, no duplicate winners, exhausted teams stop', () => {
  const s = state();
  for (let i = 0; i < 20; i++) {
    const rows = departmentChances(s);
    assert.ok(rows[0].tickets > 0);
    assert.equal(selectDepartment(rows, 0).key, 'a');
    const person = eligiblePeople(s).find(p => p.department === 'A');
    s.winners.push({ personId: person.id, department: 'A' });
  }
  assert.equal(new Set(s.winners.map(w => w.personId)).size, 20);
  assert.equal(departmentChances(s)[0].tickets, 0);
  s.winners = [];
  assert.equal(departmentChances(s)[0].percent, 10);
  s.people = s.people.filter(p => p.department === 'A');
  assert.equal(departmentChances(s)[0].percent, 100);
});

test('secure random sampling follows the configured distribution', () => {
  const rows = departmentChances(state());
  const counts = { a: 0, b: 0, c: 0 };
  const n = 200000;
  for (let i = 0; i < n; i++) counts[selectDepartment(rows, crypto.randomInt(DRAW_TICKETS)).key]++;
  for (const row of rows) {
    const p = row.percent / 100;
    assert.ok(Math.abs(counts[row.key] - n * p) < 7 * Math.sqrt(n * p * (1 - p)));
  }
});

test('every additional win lowers odds further and redistributes to other teams', () => {
  const s = state();
  let previous = departmentChances(s);
  for (let n = 1; n <= 4; n++) {
    s.winners.push({ personId: String(n - 1), department: 'A' });
    const rows = departmentChances(s);
    const weight = 10 * [1, 0.4, 0.06, 0.0015, 0.0001][n];
    assert.ok(Math.abs(rows[0].percent - weight / (110 - weight) * 100) < 1e-9);
    assert.ok(rows[0].percent < previous[0].percent);
    assert.ok(rows[1].percent > previous[1].percent);
    assert.ok(rows[2].percent > previous[2].percent);
    assert.equal(rows.reduce((sum, g) => sum + g.tickets, 0), DRAW_TICKETS);
    previous = rows;
  }
  s.settings.departmentWeights = rebalanceDepartment(previous, 'a', 0.0005);
  assert.ok(Math.abs(departmentChances(s)[0].percent - 0.0005) < 1e-9);
});

test('default odds are equal for small and large teams and gains are equal', () => {
  const s = state();
  s.settings.departmentWeights = {};
  s.people = s.people.filter(p => p.department !== 'A' || p.id === '0');
  let rows = departmentChances(s);
  assert.ok(Math.abs(rows[0].percent - rows[1].percent) < 1e-9);
  s.winners.push({personId: '40', department: 'C'});
  rows = departmentChances(s);
  assert.ok(Math.abs(rows[0].percent - 400 / 9) < 1e-9);
  assert.ok(Math.abs(rows[0].percent - rows[1].percent) < 1e-9);
  assert.ok(rows[2].percent < rows[0].percent);
});

test('an already-winning team gets no redistribution when another team wins', () => {
  const s = state();
  s.settings.departmentWeights = {};
  s.winners.push({ personId: '0', department: 'A' });
  const before = departmentChances(s);
  s.winners.push({ personId: '20', department: 'B' });
  const after = departmentChances(s);
  assert.equal(after[0].weight, before[0].weight);
  assert.ok(after[2].percent > before[2].percent);
  assert.ok(Math.abs(after[2].percent - 2200 / 30) < 1e-9);
});

test('screenshot case: AI probability increases after another team wins', () => {
  const s = { people: [], winners: [], excluded: [], settings: { departmentWeights: {} } };
  for (let team = 0; team < 9; team++) {
    const department = team === 0 ? 'AI' : `Team ${team}`;
    for (let person = 0; person < 10; person++) s.people.push({ id: `${team}-${person}`, department });
    const wins = team === 0 ? 0 : team >= 7 ? 2 : 1;
    for (let person = 0; person < wins; person++) s.winners.push({ personId: `${team}-${person}`, department });
  }
  const rows = departmentChances(s);
  const ai = rows.find(g => g.key === 'ai');
  assert.ok(Math.abs(ai.percent - 72) < 1e-9);
  const n = 200000;
  let hits = 0;
  for (let i = 0; i < n; i++) if (selectDepartment(rows, crypto.randomInt(DRAW_TICKETS)).key === 'ai') hits++;
  const p = ai.percent / 100;
  assert.ok(Math.abs(hits - n * p) < 7 * Math.sqrt(n * p * (1 - p)));
  s.winners.push({ personId: '1-1', department: 'Team 1' });
  const after = departmentChances(s);
  assert.ok(Math.abs(after.find(g => g.key === 'ai').percent - 75.7777777777778) < 1e-9);
  assert.equal(after.find(g => g.key === 'team 2').weight, rows.find(g => g.key === 'team 2').weight);
  // Same state stays stable; merely loading or waiting must never change draw odds.
  assert.deepEqual(departmentChances(s), after);
});

test('exhausting a team never adds weight to another already-winning team', () => {
  const s = state();
  s.settings.departmentWeights = {};
  s.people = s.people.filter(p => p.department !== 'B' || p.id === '20');
  s.winners.push({personId: '0', department: 'A'});
  const before = departmentChances(s);
  s.winners.push({personId: '20', department: 'B'});
  const after = departmentChances(s);
  assert.equal(after[0].weight, before[0].weight);
  assert.ok(after[2].tickets > before[2].tickets);
  assert.equal(after[1].tickets, 0);
});

test('selection continues when only already-winning teams with zero configured odds remain', () => {
  const s = state();
  s.people = s.people.filter((p) => ['0', '20', '21'].includes(p.id));
  s.settings.departmentWeights = { a: 100, b: 0 };
  s.winners.push({ personId: '20', department: 'B' });
  assert.equal(selectWinner(s, () => 0).winner.id, '0');
  s.winners.push({ personId: '0', department: 'A' });
  assert.equal(selectWinner(s, () => 0).winner.id, '21');
});

test('full server selection: 100 complete sessions, 6000 draws, no duplicates or lost tickets', () => {
  for (let session = 0; session < 100; session++) {
    const s = state();
    s.settings.departmentWeights = {};
    const seen = new Set();
    for (let turn = 0; turn < 60; turn++) {
      const before = departmentChances(s);
      const selection = selectWinner(s, max => crypto.randomInt(max));
      assert.ok(selection);
      assert.ok(!seen.has(selection.winner.id));
      seen.add(selection.winner.id);
      s.winners.push({personId: selection.winner.id, department: selection.winner.department});
      const after = departmentChances(s);
      if (after.some(g => g.eligible && g.wonCount === 0)) {
        for (let i = 0; i < after.length; i++) {
          if (before[i].wonCount > 0 && after[i].wonCount === before[i].wonCount) assert.equal(after[i].weight, before[i].weight);
          if (after[i].wonCount === 0 && after[i].eligible) assert.ok(after[i].tickets >= before[i].tickets);
        }
      }
    }
    assert.equal(selectWinner(s, max => crypto.randomInt(max)), null);
    assert.equal(seen.size, 60);
  }
});
