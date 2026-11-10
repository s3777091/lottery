// Runs once when the server starts. With DATABASE_URL set, loading the state here creates the rows in the
// lottery database right away (importing data/state.json as the test list on a fresh database) instead of
// waiting for the first signed-in request. A database problem is logged and never blocks start-up.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.DATABASE_URL) return;
  try {
    const { load } = await import('./lib/store');
    const s = await load();
    console.log(`[lottery-db] ready: list=${s.mode}, test=${s.lists.test.people} people, real=${s.lists.real.people} people`);
  } catch (err) {
    console.error('[lottery-db] startup load failed:', (err as Error).message);
  }
}
