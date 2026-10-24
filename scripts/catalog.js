// GET /models only: verifies authentication and lists NVIDIA Nemotron IDs. Never runs inference or prints the key.
import { NebiusClient } from '../src/nebius.js';
const client=new NebiusClient();
if(!process.env.NEBIUS_API_KEY){console.log('NEBIUS_API_KEY is not set in .env');process.exit(2);}
const models=await client.catalog();
console.log(JSON.stringify({status:'CONNECTED',inference:'not called',nemotron:models},null,2));
