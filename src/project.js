import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { Journey } from './schema.js';
import { contained, json } from './files.js';

const file=z.object({path:z.string().min(1).max(180),content:z.string().max(2000000),encoding:z.enum(['utf8','base64']).default('utf8')}).strict();
export function fileBytes(file){return Buffer.from(file.content,file.encoding==='base64'?'base64':'utf8');}
export const ProjectRequest=z.object({name:z.string().min(1).max(100),mode:z.enum(['reference','nebius']),confirmation:z.string().optional(),inputKind:z.enum(['source','static-output']).default('source'),files:z.array(file).min(1).max(80),editedFiles:z.array(file).max(80).optional(),journey:Journey,functionalJourney:Journey,guards:z.array(Journey).max(6).optional()}).strict().superRefine((p,ctx)=>{
 if(p.journey.profile!=='keyboard'||p.functionalJourney.profile!=='pointer')ctx.addIssue({code:'custom',message:'Provide separate keyboard and pointer tasks'});
 if(p.mode==='reference'&&!p.editedFiles?.length)ctx.addIssue({code:'custom',message:'Select the edited folder to verify a patch'});
});
export function validateProjectFiles(files){
 let total=0;const seen=new Set();
 for(const file of files){
  if(!/\.(html|css|js|svg|json|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|txt)$/.test(file.path)||/[\x00-\x1f\\:*?"<>|]/.test(file.path)||file.path.split('/').some(p=>!p||p.startsWith('.')||/[. ]$/.test(p)||/^(node_modules|vendor|scripts|tests|secrets|credentials|con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p))||seen.has(file.path.toLowerCase()))throw new Error('Only distinct static files are accepted; hidden, dependency and sensitive paths are excluded');
  if(file.encoding==='base64'&&(!/\.(png|jpg|jpeg|webp|gif|ico|woff2?|ttf)$/.test(file.path)||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content)))throw new Error('Invalid binary static asset');
  if(/(?:Bearer\s+[A-Za-z0-9._-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|v1\.[A-Za-z0-9_-]{60,}\.[A-Za-z0-9_-]{30,})/.test(file.content))throw new Error('Credential-like content found; remove credentials before importing source');
  total+=fileBytes(file).length;seen.add(file.path.toLowerCase());
 }
 if(total>8000000||!files.some(f=>f.path==='index.html'&&f.encoding!=='base64'))throw new Error('Expected index.html and at most 8 MB of browser-executable static files');
 return total;
}
export async function stageProject(raw,root,id){
 const input=ProjectRequest.parse(raw);validateProjectFiles(input.files);if(input.editedFiles)validateProjectFiles(input.editedFiles);
 await fs.mkdir(path.join(root,'imports'),{recursive:true});
 const dir=path.join(root,'imports',id);await fs.mkdir(dir,{recursive:false});
 for(const [label,files]of [['original',input.files],['edited',input.editedFiles]]){
  if(!files)continue;const target=path.join(dir,label);await fs.mkdir(target);
  for(const file of files){const dest=await contained(target,file.path,{existing:false});await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,fileBytes(file));}
 }
 await json(path.join(dir,'tasks.json'),{journey:input.journey,functionalJourney:input.functionalJourney,...(input.guards?.length?{guards:input.guards}:{})});
 return {fixture:'custom-project',mode:input.mode,sourceRoot:path.join(dir,'original'),referenceRoot:input.editedFiles?path.join(dir,'edited'):undefined,journey:input.journey,functionalJourney:input.functionalJourney,guards:input.guards||[],sourceMetadata:{kind:input.inputKind,name:input.name,files:input.files.length,scope:input.inputKind==='static-output'?'Verifies and edits selected browser output only; does not rebuild or repair original framework source.':'Browser-executable static source.'},maxAttempts:3,freshInference:input.mode==='nebius'};
}
