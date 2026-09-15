import test from 'node:test';
import assert from 'node:assert/strict';
import {navigationFor,activeAdminSection} from '../src/features/admin/navigation.ts';
import {adminReturnPath} from '../src/features/admin/return-path.ts';

test('navigation matches management visibility, including combined roles',()=>{
 for(const roles of [[],['farmer_referrer'],['employee'],['employee','farmer_referrer']])assert.deepEqual(navigationFor(roles),[]);
 const manager=navigationFor(['manager']);
 assert.equal(manager.some(item=>item.id==='trash'),false);
 assert.equal(manager.find(item=>item.id==='staff')?.label,'Team activity');
 assert.equal(navigationFor(['employee','super_admin']).length,9);
 assert.equal(navigationFor(['manager','super_admin']).find(item=>item.id==='staff')?.label,'Team & access');
 for(const route of ['/dashboard/admin/payments/example','/dashboard/admin/payments/another'])assert.equal(activeAdminSection(route,null),'exceptions');
 assert.equal(activeAdminSection('/dashboard/admin/new/grant',null),'grants');
});

test('detail return paths preserve filters and reject arbitrary/privileged targets',()=>{
 const valid='/dashboard/admin?section=registrations&q=Patil&page=2&size=50&status=completed';
 const returned=new URL(adminReturnPath(valid),'http://localhost');
 assert.equal(returned.searchParams.get('q'),'Patil');assert.equal(returned.searchParams.get('page'),'2');assert.equal(returned.searchParams.get('size'),'50');
 for(const value of ['https://example.com','//example.com','javascript:alert(1)','/dashboard/admin/new/staff','/dashboard/admin?section=trash','/dashboard/admin?section=registrations&size=99999'])assert.equal(adminReturnPath(value),'/dashboard/admin?section=registrations');
 assert.ok(adminReturnPath('/dashboard/admin?section=trash','trash',true).includes('section=trash'));
});
