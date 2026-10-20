import { verifyProof } from '../src/proof.js';
if(!process.argv[2]){console.error('Usage: npm run proof:verify -- artifacts/runs/RUN_ID');process.exit(2);}
const result=await verifyProof(process.argv[2]);console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
