import {spawnSync} from 'node:child_process';
const database=process.env.TEST_DATABASE_URL;
if(!database)throw Error('Set TEST_DATABASE_URL to an isolated PostgreSQL test database.');
const url=new URL(database);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Database regression runner only permits loopback test databases.');
for(const file of ['tests/database-regression.sql','tests/admin-workspace.sql','tests/admin-delete-confirmation.sql']){
 const result=spawnSync(process.env.PSQL_PATH||'psql',['-X','-v','ON_ERROR_STOP=1','-f',file,'--dbname',database],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status){process.exitCode=result.status;break;}
}
