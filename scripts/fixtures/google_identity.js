// Signed, preview-only identity fixtures. Normal deployments never upload this file.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { initialize, query, transaction } from '../lib/database.js';
import { encryptPhone, phoneHash, inviteCode } from '../lib/core.js';
import { prepareAccountMerge } from '../lib/account-merge.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  try {
    if (process.env.VERCEL_ENV !== 'preview' || process.env.TESTING_MODE !== 'true' || req.method !== 'POST') throw Error('not_available');
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!b || Math.abs(Date.now() - b.timestamp) > 60000 || !/^qa-google-[0-9a-f-]{36}$/.test(b.nonce) || !/^\w{64}$/.test(b.sessionHash) || !/^[-0-9a-f]{36}$/.test(b.userId)) throw Error('invalid_fixture');
    const signature = createHmac('sha256', process.env.APP_SECRET).update(JSON.stringify(b)).digest('hex');
    const sent = String(req.headers['x-jishoo-qa'] || '');
    if (sent.length !== signature.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(sent))) throw Error('invalid_signature');
    await initialize();
    const owned = (await query('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND u.id=$2 AND s.expires_at>NOW()', [b.sessionHash, b.userId]))[0];
    if (!owned) throw Error('owned_session_only');
    if (!(await query('INSERT INTO setup_nonces(nonce) VALUES($1) ON CONFLICT DO NOTHING RETURNING nonce', [b.nonce]))[0]) throw Error('replayed');
    if (b.operation === 'merge-proof' || b.operation === 'expired-merge-proof') {
      if (!owned.registered || !owned.handle?.startsWith('qa_') || owned.role !== 'member' || !owned.name.startsWith('آزمایش')) throw Error('qa_accounts_only');
      const target = (await query("SELECT u.*,a.subject FROM users u JOIN auth_identities a ON a.user_id=u.id AND a.provider='google' AND a.subject='qa-google-'||u.id WHERE u.id=$1 AND u.registered AND u.handle LIKE 'qa_%' AND u.role='member' AND u.name LIKE 'آزمایش%'", [b.targetId]))[0];
      if (!target || target.id === owned.id) throw Error('qa_target_only');
      const ready = await prepareAccountMerge(owned, target, { subject: target.subject, email: 'qa-' + target.id + '@example.invalid' }, b.sessionHash);
      if (!ready) throw Error('merge_not_allowed');
      if (b.operation === 'expired-merge-proof') await query("UPDATE account_merge_proofs SET expires_at=NOW()-INTERVAL '1 minute' WHERE session_hash=$1", [b.sessionHash]);
    } else if (b.operation === 'legacy-phone') {
      if (owned.registered || !/^\+1[2-9]\d{2}55501\d{2}$/.test(b.phone)) throw Error('fictional_legacy_only');
      const code = inviteCode();
      await transaction([
        ["UPDATE users SET registered=TRUE,name='آزمایش حساب شماره',avatar_seed='آزمایش حساب شماره',phone_hash=$2,phone_cipher=$3,handle=$4,invite_code=$5,trial_days_bank=7,terms_version='2026-10-17',terms_accepted_at=NOW() WHERE id=$1 AND NOT registered", [owned.id, phoneHash(b.phone), encryptPhone(b.phone), 'qa_' + owned.id.replaceAll('-', '').slice(0, 16), code]],
        ["INSERT INTO invites(code,inviter_id,max_uses) VALUES($1,$2,3)", [code, owned.id]],
      ]);
    } else {
      if (owned.registered || b.operation) throw Error('guest_fixture_only');
      await query("INSERT INTO pending_google(session_hash,subject,email_cipher,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '10 minutes') ON CONFLICT(session_hash) DO UPDATE SET subject=EXCLUDED.subject,email_cipher=EXCLUDED.email_cipher,expires_at=EXCLUDED.expires_at", [b.sessionHash, 'qa-google-' + owned.id, encryptPhone('qa-' + owned.id + '@example.invalid')]);
    }
    res.statusCode = 200;
    res.end(JSON.stringify({ ready: true }));
  } catch { res.statusCode = 403; res.end(JSON.stringify({ error: 'fixture_unavailable' })); }
}
