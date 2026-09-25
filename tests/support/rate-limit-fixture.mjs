import {createHmac} from 'node:crypto';
import {spawnSync} from 'node:child_process';

// Test-only clock advance for one account; never connect to a hosted database.
export function expireAccountRateLimit(mobile){
 const database=process.env.TEST_DATABASE_URL;
 if(!database||!['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname))throw Error('Rate-limit fixtures require an isolated loopback database.');
 if(!/^[0-9]{10}$/.test(mobile)||!process.env.SESSION_SECRET)throw Error('Synthetic mobile and isolated session secret are required.');
 const key=createHmac('sha256',process.env.SESSION_SECRET).update('login-account:'+mobile).digest('hex');
 const result=spawnSync(process.env.PSQL_PATH||'psql',['-X','-q','-v','ON_ERROR_STOP=1','--dbname',database],{
  input:"update private.rate_limits set resets_at=now()-interval '1 second' where key='"+key+"';",
  encoding:'utf8',windowsHide:true
 });
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('Could not expire the isolated account rate-limit fixture.');
}
