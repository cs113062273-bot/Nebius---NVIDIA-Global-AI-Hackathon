import path from 'node:path';
import { NebiusClient } from '../src/nebius.js';
import { ROOT } from '../src/catalog.js';
import { runRepair } from '../src/engine.js';
import { json } from '../src/files.js';
const client=new NebiusClient({dir:path.join(ROOT,'artifacts','inference')});
if(!client.configured()){const result={status:'NOT_TESTED',reason:'No enabled sponsor-only Nebius credentials',calls:0,at:new Date().toISOString()};await json(path.join(ROOT,'benchmarks','live-status.json'),result);console.log(JSON.stringify(result,null,2));process.exitCode=2;}
else{const models=await client.models();console.log('Available NVIDIA Nemotron models:',JSON.stringify(models));if(process.argv.includes('--repair')){const run=await runRepair({mode:'nebius',maxAttempts:1});const result={status:run.verification?.verdict,runId:run.id,model:run.model,at:new Date().toISOString()};await json(path.join(ROOT,'benchmarks','live-status.json'),result);console.log(JSON.stringify(result,null,2));if(run.verification?.verdict!=='VERIFIED_PASS')process.exitCode=1;}else console.log('Catalog check only. Set NEBIUS_MODEL to one of these IDs, then add --repair for one bounded repair attempt.');}
