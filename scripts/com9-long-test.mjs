import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
const port=9237;
const probe=net.createServer();await new Promise((resolve,reject)=>probe.once('error',reject).listen(port,'127.0.0.1',resolve));await new Promise(resolve=>probe.close(resolve));
await mkdir('test-results/com9-long-profile',{recursive:true});
const app=spawn(path.resolve('src-tauri/target/release/zhiliao-studio.exe'),[],{windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`,WEBVIEW2_USER_DATA_FOLDER:path.resolve('test-results/com9-long-profile')}});
const report={date:new Date().toISOString(),port:'COM9',baud:115200,completed:false,restored:false,events:[],original:null,error:null};
let browser,page,original;
async function range(name,value){const input=page.getByRole('slider',{name:new RegExp(`^${name}`)});await input.press('Home');const min=Number(await input.getAttribute('min'));for(let i=min;i<value;i++)await input.press('ArrowRight');}
async function settings(){if(await page.getByRole('button',{name:'语音参数',exact:true}).count())await page.getByRole('button',{name:'语音参数',exact:true}).click();}
async function workbench(){if(await page.getByRole('button',{name:'工作台',exact:true}).count())await page.getByRole('button',{name:'工作台',exact:true}).click();}
async function save(){await page.getByRole('button',{name:'保存参数',exact:true}).click();await expect(page.getByRole('status')).toContainText('参数已保存并读回',{timeout:20000});}
try{
  for(let i=0;i<90;i++){if(app.exitCode!==null)throw new Error('App exited');try{if((await fetch(`http://127.0.0.1:${port}/json/version`)).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);page=browser.contexts()[0].pages()[0];
  await page.getByRole('combobox',{name:'通道',exact:true}).selectOption('serial');await page.getByRole('combobox',{name:'端口',exact:true}).click();await page.getByPlaceholder('选择或输入 COM 口').fill('COM9');await page.getByRole('button',{name:'使用端口',exact:true}).click();
  await page.getByRole('button',{name:'连接设备',exact:true}).click();await expect(page.getByText('已从模块读取')).toBeVisible({timeout:20000});
  await settings();original={voice:await page.getByRole('combobox',{name:'发音人',exact:true}).inputValue(),volume:Number(await page.getByRole('slider',{name:/^音量/}).inputValue()),speed:Number(await page.getByRole('slider',{name:/^语速/}).inputValue()),pitch:Number(await page.getByRole('slider',{name:/^语调/}).inputValue())};report.original=original;
  await page.getByRole('combobox',{name:'发音人',exact:true}).selectOption('3');await range('音量',3);await range('语速',30);await range('语调',5);await save();
  await workbench();const text='这是知了模块的长文本连续播报测试。我们正在检查完整句子和分段播放。'.repeat(24);
  report.characters=Array.from(text).length;report.utf8Bytes=Buffer.byteLength(text,'utf8');
  await page.getByRole('combobox',{name:'编码',exact:true}).selectOption('5');await page.getByLabel('播报文本',{exact:true}).fill(text);
  report.startedAt=new Date().toISOString();await page.getByRole('button',{name:'开始播报'}).click();
  const deadline=Date.now()+180000;
  while(Date.now()<deadline){
    const errors=await page.getByRole('alert').allTextContents();if(errors.length)throw new Error(errors.join(' '));
    const progress=await page.getByText(/\d+ \/ \d+ 段已完成/).allTextContents();
    const match=progress.join(' ').match(/(\d+) \/ (\d+) 段已完成/);
    if(match&&Number(match[1])>1&&match[1]===match[2]){report.completed=true;report.completedSegments=Number(match[1]);break;}
    await new Promise(r=>setTimeout(r,500));
  }
  if(!report.completed)throw new Error('180秒内未自然完成全部长文本分段');
  report.finishedAt=new Date().toISOString();
  report.events=await page.locator('.log-row').allTextContents();
  await page.screenshot({path:'docs/screenshots/com9-long-completed.png'});
}catch(error){report.error=String(error);if(page)report.events=await page.locator('.log-row').allTextContents().catch(()=>[]);process.exitCode=1;}
finally{
  if(page&&original){try{
    await workbench();await page.getByRole('button',{name:'停止',exact:true}).click();
    await settings();await page.getByRole('combobox',{name:'发音人',exact:true}).selectOption(original.voice);await range('音量',original.volume);await range('语速',original.speed);await range('语调',original.pitch);await save();
    report.restored=Number(await page.getByRole('slider',{name:/^语速/}).inputValue())===original.speed&&Number(await page.getByRole('slider',{name:/^音量/}).inputValue())===original.volume&&Number(await page.getByRole('slider',{name:/^语调/}).inputValue())===original.pitch&&(await page.getByRole('combobox',{name:'发音人',exact:true}).inputValue())===original.voice;
    await page.getByRole('button',{name:'断开连接'}).click();
  }catch(error){report.restoreError=String(error);process.exitCode=1;}}
  await writeFile('docs/com9-long-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,events:`${report.events.length} log entries`},null,2));
  if(browser)await browser.close().catch(()=>{});if(app.exitCode===null)app.kill();
}
