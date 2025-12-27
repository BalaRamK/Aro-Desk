(()=>{var e={};e.id=893,e.ids=[893],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},64939:e=>{"use strict";e.exports=import("pg")},96239:(e,t,r)=>{"use strict";r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{patchFetch:()=>c,routeModule:()=>_,serverHooks:()=>$,workAsyncStorage:()=>l,workUnitAsyncStorage:()=>u});var s=r(42706),n=r(28203),i=r(45994),o=r(54221),d=e([o]);o=(d.then?(await d)():d)[0];let _=new s.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/webhooks/n8n/route",pathname:"/api/webhooks/n8n",filename:"route",bundlePath:"app/api/webhooks/n8n/route"},resolvedPagePath:"/Volumes/Extreme SSD/Aro Desk/app/api/webhooks/n8n/route.ts",nextConfigOutput:"",userland:o}),{workAsyncStorage:l,workUnitAsyncStorage:u,serverHooks:$}=_;function c(){return(0,i.patchFetch)({workAsyncStorage:l,workUnitAsyncStorage:u})}a()}catch(e){a(e)}})},96487:()=>{},78335:()=>{},54221:(e,t,r)=>{"use strict";r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{POST:()=>o});var s=r(39187),n=r(62545),i=e([n]);async function o(e){try{let{integration_id:t,sync_log_id:r,data_type:a,records:i,source_type:o,api_key:l}=await e.json(),u=process.env.N8N_WEBHOOK_API_KEY||"change-this-in-production";if(l!==u)return s.NextResponse.json({error:"Unauthorized"},{status:401});if(!t||!a||!Array.isArray(i))return s.NextResponse.json({error:"Missing required fields: integration_id, data_type, records"},{status:400});let $=await (0,n.P)("SELECT tenant_id FROM integration_sources WHERE id = $1",[t]);if(0===$.rows.length)return s.NextResponse.json({error:"Integration not found"},{status:404});let p=$.rows[0].tenant_id,y={processed:0,created:0,updated:0,failed:0};for(let e of i)try{y.processed++,"contacts"===a?(await d(p,t,o,e),y.created++):"tickets"===a?(await c(p,t,o,e),y.created++):"deals"===a?(await _(p,t,o,e),y.created++):y.failed++}catch(e){console.error("Error processing record:",e),y.failed++}return r&&(await (0,n.P)(`UPDATE integration_sync_logs 
         SET status = $1,
             records_processed = $2,
             records_created = $3,
             records_updated = $4,
             records_failed = $5,
             sync_completed_at = NOW(),
             duration_ms = EXTRACT(EPOCH FROM (NOW() - sync_started_at)) * 1000
         WHERE id = $6`,[0===y.failed?"success":y.failed===y.processed?"failed":"partial",y.processed,y.created,y.updated,y.failed,r]),await (0,n.P)(`UPDATE integration_sources 
         SET last_sync_at = NOW(),
             last_sync_status = $1,
             sync_count = sync_count + 1
         WHERE id = $2`,[0===y.failed?"success":"partial",t])),s.NextResponse.json({success:!0,stats:y})}catch(e){return console.error("Webhook error:",e),s.NextResponse.json({error:"Internal server error",message:String(e)},{status:500})}}async function d(e,t,r,a){let{external_id:s,account_id:i,first_name:o,last_name:d,email:c,phone:_,title:l,...u}=a,$=await (0,n.P)("SELECT id FROM external_contacts WHERE tenant_id = $1 AND external_id = $2 AND source_type = $3",[e,s,r]);if($.rows.length>0)await (0,n.P)(`UPDATE external_contacts 
       SET first_name = $1, last_name = $2, email = $3, phone = $4, 
           title = $5, account_id = $6, properties = $7, 
           last_synced_at = NOW(), updated_at = NOW()
       WHERE id = $8`,[o,d,c,_,l,i,JSON.stringify(u),$.rows[0].id]),await (0,n.P)(`UPDATE integration_synced_records 
       SET last_updated_at = NOW(), sync_status = 'synced', raw_data = $1
       WHERE integration_source_id = $2 AND external_id = $3`,[JSON.stringify(a),t,s]);else{let $=await (0,n.P)(`INSERT INTO external_contacts 
       (tenant_id, external_id, source_type, first_name, last_name, 
        email, phone, title, account_id, properties)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,[e,s,r,o,d,c,_,l,i,JSON.stringify(u)]);await (0,n.P)(`INSERT INTO integration_synced_records 
       (integration_source_id, external_id, external_type, internal_table, internal_id, sync_status, raw_data)
       VALUES ($1, $2, 'contact', 'external_contacts', $3, 'synced', $4)`,[t,s,$.rows[0].id,JSON.stringify(a)])}}async function c(e,t,r,a){let{external_id:s,account_id:i,title:o,description:d,status:c,priority:_,ticket_type:l,reporter_email:u,assignee_email:$,created_date:p,updated_date:y,resolved_date:E,...w}=a,N=await (0,n.P)("SELECT id FROM external_tickets WHERE tenant_id = $1 AND external_id = $2 AND source_type = $3",[e,s,r]);if(N.rows.length>0)await (0,n.P)(`UPDATE external_tickets 
       SET title = $1, description = $2, status = $3, priority = $4,
           ticket_type = $5, reporter_email = $6, assignee_email = $7,
           created_date = $8, updated_date = $9, resolved_date = $10,
           account_id = $11, properties = $12,
           last_synced_at = NOW(), updated_at = NOW()
       WHERE id = $13`,[o,d,c,_,l,u,$,p,y,E,i,JSON.stringify(w),N.rows[0].id]),await (0,n.P)(`UPDATE integration_synced_records 
       SET last_updated_at = NOW(), sync_status = 'synced', raw_data = $1
       WHERE integration_source_id = $2 AND external_id = $3`,[JSON.stringify(a),t,s]);else{let N=await (0,n.P)(`INSERT INTO external_tickets 
       (tenant_id, external_id, source_type, title, description, status, 
        priority, ticket_type, reporter_email, assignee_email, 
        created_date, updated_date, resolved_date, account_id, properties)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,[e,s,r,o,d,c,_,l,u,$,p,y,E,i,JSON.stringify(w)]);await (0,n.P)(`INSERT INTO integration_synced_records 
       (integration_source_id, external_id, external_type, internal_table, internal_id, sync_status, raw_data)
       VALUES ($1, $2, 'ticket', 'external_tickets', $3, 'synced', $4)`,[t,s,N.rows[0].id,JSON.stringify(a)])}}async function _(e,t,r,a){let{external_id:s,account_id:i,name:o,amount:d,stage:c,probability:_,close_date:l,created_date:u,owner_email:$,...p}=a,y=await (0,n.P)("SELECT id FROM external_deals WHERE tenant_id = $1 AND external_id = $2 AND source_type = $3",[e,s,r]);if(y.rows.length>0)await (0,n.P)(`UPDATE external_deals 
       SET name = $1, amount = $2, stage = $3, probability = $4,
           close_date = $5, owner_email = $6, account_id = $7,
           properties = $8, last_synced_at = NOW(), updated_at = NOW()
       WHERE id = $9`,[o,d,c,_,l,$,i,JSON.stringify(p),y.rows[0].id]),await (0,n.P)(`UPDATE integration_synced_records 
       SET last_updated_at = NOW(), sync_status = 'synced', raw_data = $1
       WHERE integration_source_id = $2 AND external_id = $3`,[JSON.stringify(a),t,s]);else{let y=await (0,n.P)(`INSERT INTO external_deals 
       (tenant_id, external_id, source_type, name, amount, stage, 
        probability, close_date, created_date, owner_email, account_id, properties)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,[e,s,r,o,d,c,_,l,u,$,i,JSON.stringify(p)]);await (0,n.P)(`INSERT INTO integration_synced_records 
       (integration_source_id, external_id, external_type, internal_table, internal_id, sync_status, raw_data)
       VALUES ($1, $2, 'deal', 'external_deals', $3, 'synced', $4)`,[t,s,y.rows[0].id,JSON.stringify(a)])}}n=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})},62545:(e,t,r)=>{"use strict";r.a(e,async(e,a)=>{try{r.d(t,{Fh:()=>d,KU:()=>o,P:()=>i});var s=r(64939),n=e([s]);let c=new(s=(n.then?(await n)():n)[0]).Pool({connectionString:process.env.DATABASE_URL,max:20,idleTimeoutMillis:3e4,connectionTimeoutMillis:2e3});async function i(e,t){let r=Date.now();try{let a=await c.query(e,t),s=Date.now()-r;return console.log("Executed query",{text:e,duration:s,rows:a.rowCount}),a}catch(e){throw console.error("Database query error:",e),e}}async function o(){return c.connect()}async function d(e,t){let r=`SET LOCAL app.current_user_id = '${e}'`;t?await t.query(r):await i(r)}a()}catch(e){a(e)}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[638,452],()=>r(96239));module.exports=a})();