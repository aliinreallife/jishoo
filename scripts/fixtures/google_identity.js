// Explicit preview-only integration fixture. Not uploaded by normal deployments.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {initialize,query} from '../lib/database.js';
import {encryptPhone} from '../lib/core.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 try{
  if(process.env.VERCEL_ENV!=='preview'||process.env.TESTING_MODE!=='true'||req.method!=='POST')throw Error('not_available');
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!b||Math.abs(Date.now()-b.timestamp)>60000||!/^qa-google-[0-9a-f-]{36}$/.test(b.nonce)||!/^\w{64}$/.test(b.sessionHash)||!/^[-0-9a-f]{36}$/.test(b.userId))throw Error('invalid_fixture');
  const signature=createHmac('sha256',process.env.APP_SECRET).update(JSON.stringify(b)).digest('hex'),sent=String(req.headers['x-jishoo-qa']||'');
  if(sent.length!==signature.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(sent)))throw Error('invalid_signature');
  await initialize();
  const owned=await query('SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND u.id=$2 AND NOT u.registered AND s.expires_at>NOW()',[b.sessionHash,b.userId]);
  if(!owned[0])throw Error('guest_fixture_only');
  const nonce=await query('INSERT INTO setup_nonces(nonce) VALUES($1) ON CONFLICT DO NOTHING RETURNING nonce',[b.nonce]);if(!nonce[0])throw Error('replayed');
  const email='qa-'+b.userId+'@example.invalid';
  await query("INSERT INTO pending_google(session_hash,subject,email_cipher,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '10 minutes') ON CONFLICT(session_hash) DO UPDATE SET subject=EXCLUDED.subject,email_cipher=EXCLUDED.email_cipher,expires_at=EXCLUDED.expires_at",[b.sessionHash,'qa-google-'+b.userId,encryptPhone(email)]);
  res.statusCode=200;res.end(JSON.stringify({ready:true}));
 }catch(e){res.statusCode=403;res.end(JSON.stringify({error:'fixture_unavailable'}))}
}
