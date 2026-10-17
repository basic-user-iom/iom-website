import {productionDatabase,assertProductionTarget} from './crm-email-production.mjs'
export function createProductionOAuthStore(acquire,ownerId) {
  async function tx(work) {
    const c=await acquire()
    try {await c.query('begin');await c.query("set local statement_timeout='5s'");await c.query("set local lock_timeout='5s'");const r=await work(c);await c.query('commit');return r}
    catch(error){await c.query('rollback').catch(()=>{});throw error}finally{c.release()}
  }
  const one=async(c,sql,args)=>(await c.query(sql,args)).rows[0]
  const revoke=(c,id)=>c.query('update crm_email_private.grant_families set revoked_at=coalesce(revoked_at,statement_timestamp()) where owner_id=$1 and id=$2',[ownerId,id])
  async function validGrant(c,id) {
    return one(c,`select g.* from crm_email_private.grant_families g join public.crm_staff_profiles s on s.id=g.owner_id and s.active
      where g.owner_id=$1 and g.id=$2 and g.revoked_at is null and g.expires_at>statement_timestamp() for update of g`,[ownerId,id])
  }
  return {
    staffActive:()=>tx(async c=>(await one(c,'select active from public.crm_staff_profiles where id=$1',[ownerId]))?.active===true),
    async rateLimit(){return tx(async c=>(await one(c,`insert into crm_email_private.oauth_limits values($1,statement_timestamp(),1)
      on conflict(owner_id) do update set hits=case when oauth_limits.window_start<statement_timestamp()-interval '1 minute' then 1 else least(oauth_limits.hits+1,100000) end,
      window_start=case when oauth_limits.window_start<statement_timestamp()-interval '1 minute' then statement_timestamp() else oauth_limits.window_start end returning hits`,[ownerId])).hits<=60)},
    saveRequest:row=>tx(c=>c.query('insert into crm_email_private.oauth_requests(digest,request_id,owner_id,data,expires_at) values($1,$2,$3,$4,$5)',[row.digest,row.requestId,ownerId,JSON.stringify(row),row.expiresAt])),
    consumeRequest:(digest,requestId)=>tx(async c=>(await one(c,`update crm_email_private.oauth_requests set consumed=true where owner_id=$1 and digest=$2 and request_id=$3 and not consumed and expires_at>statement_timestamp() returning data`,[ownerId,digest,requestId]))?.data||null),
    saveCode:row=>tx(async c=>{
      if(row.ownerId!==ownerId)throw Error('owner_mismatch')
      await c.query(`insert into crm_email_private.grant_families(id,owner_id,scopes,expires_at) values($1,$2,$3,statement_timestamp()+interval '14 days')`,[row.familyId,ownerId,row.scope.split(' ')])
      await c.query('insert into crm_email_private.oauth_codes(digest,family_id,owner_id,data,expires_at) values($1,$2,$3,$4,$5)',[row.digest,row.familyId,ownerId,JSON.stringify(row),row.expiresAt])
    }),
    exchangeCode:({codeDigest,challenge,refreshDigest,refreshExpires})=>tx(async c=>{
      const row=await one(c,'select * from crm_email_private.oauth_codes where owner_id=$1 and digest=$2 for update',[ownerId,codeDigest])
      if(!row)return null
      const grant=await validGrant(c,row.family_id)
      const valid=(await one(c,'select $1::timestamptz>statement_timestamp() as valid',[row.expires_at])).valid
      if(row.consumed || !valid || row.data.codeChallenge!==challenge || !grant){await revoke(c,row.family_id);return null}
      await c.query('update crm_email_private.oauth_codes set consumed=true where digest=$1',[codeDigest])
      await c.query(`insert into crm_email_private.oauth_refreshes(digest,family_id,owner_id,data,expires_at) values($1,$2,$3,$4,least($5::timestamptz,$6::timestamptz))`,[refreshDigest,row.family_id,ownerId,JSON.stringify(row.data),refreshExpires,grant.expires_at])
      return row.data
    }),
    rotateRefresh:({oldDigest,refreshDigest,refreshExpires})=>tx(async c=>{
      const row=await one(c,'select * from crm_email_private.oauth_refreshes where owner_id=$1 and digest=$2 for update',[ownerId,oldDigest])
      if(!row)return null
      const grant=await validGrant(c,row.family_id)
      const valid=(await one(c,'select $1::timestamptz>statement_timestamp() as valid',[row.expires_at])).valid
      if(row.consumed || !valid || !grant){await revoke(c,row.family_id);return null}
      await c.query('update crm_email_private.oauth_refreshes set consumed=true where digest=$1',[oldDigest])
      await c.query(`insert into crm_email_private.oauth_refreshes(digest,family_id,owner_id,data,expires_at) values($1,$2,$3,$4,least($5::timestamptz,$6::timestamptz))`,[refreshDigest,row.family_id,ownerId,JSON.stringify(row.data),refreshExpires,grant.expires_at])
      return row.data
    }),
    revokePresented:digest=>tx(async c=>{
      const row=await one(c,`select family_id from crm_email_private.oauth_refreshes where owner_id=$1 and digest=$2
        union select family_id from crm_email_private.oauth_codes where owner_id=$1 and digest=$2`,[ownerId,digest])
      if(row)await revoke(c,row.family_id)
    }),
    revokeFamily:id=>tx(c=>revoke(c,id)),
    grantActive:id=>tx(async c=>!!await validGrant(c,id)),
  }
}
let pool
export async function acquireEmailOAuthConnection() {
  assertProductionTarget()
  if(!pool){const {Pool}=await import('pg');pool=new Pool({...productionDatabase(process.env,'iom_email_oauth'),max:4,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});pool.on('error',()=>{})}
  return pool.connect()
}
