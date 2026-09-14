import assert from 'node:assert/strict';

// Run after deployment/domain changes; deliberately separate from offline CI.
const canonical = 'https://ganpatiagro.in';
for (const path of ['/', '/register?redirect_check=1', '/login']) {
  const target = `${canonical}${path}`;
  const redirected = await fetch(`https://www.ganpatiagro.in${path}`, {
    redirect: 'manual', signal: AbortSignal.timeout(15000),
  });
  await redirected.body?.cancel();
  assert.equal(redirected.status, 308, `www must redirect: ${path}`);
  assert.equal(redirected.headers.get('location'), target, 'Redirect must preserve path/query and use the canonical domain');

  const page = await fetch(target, {
    redirect: 'manual', signal: AbortSignal.timeout(15000),
  });
  await page.body?.cancel();
  assert.equal(page.status, 200, `Canonical URL must serve directly, without a reverse redirect: ${path}`);
  console.log(`PASS www -> canonical -> 200: ${path}`);
}
