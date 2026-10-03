import {createServer,preview} from 'vite';
import {spawn} from 'node:child_process';
const dev=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true},logLevel:'error'});
await dev.listen();let production;
try{
  production=await preview({preview:{host:'127.0.0.1',port:4173,strictPort:true},logLevel:'error'});
  const productionScripts=['scripts/game-real-ar.mjs','scripts/marker-compatibility-browser.mjs','scripts/camera-playback-browser.mjs','scripts/offline-browser.mjs'];
  const scripts=process.argv.includes('--entry-only')?['scripts/camera-entry-browser.mjs','scripts/camera-playback-browser.mjs','scripts/offline-browser.mjs']:process.argv.includes('--production-only')?productionScripts:['scripts/camera-entry-browser.mjs','scripts/nine-game-browser.mjs',...productionScripts];
  for(const script of scripts){
    await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script],{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`${script} exited ${code}`)));});
  }
}finally{await dev.close();if(production)await new Promise(resolve=>production.httpServer.close(resolve));}
