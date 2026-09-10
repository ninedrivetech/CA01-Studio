import { test, expect } from '@playwright/test';
async function connect(page:import('@playwright/test').Page){await page.goto('/');await page.getByRole('button',{name:'连接设备',exact:true}).click();await expect(page.getByText('已从模块读取')).toBeVisible();}
test('单页参数保存、播放暂停继续与日志导出',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await connect(page);
  await page.getByRole('combobox',{name:'发音人',exact:true}).selectOption('55');
  await expect(page.getByText('有未保存修改')).toBeVisible();
  await page.getByRole('button',{name:'保存参数',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('参数已保存并读回');
  await page.getByRole('button',{name:'关闭提示'}).click();
  await page.getByRole('button',{name:'开始播报'}).click();
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await expect(page.getByRole('button',{name:'继续',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'继续',exact:true}).click();
  await expect(page.getByText(/1 \/ 1 段已完成/)).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出日志'}).click();expect((await download).suggestedFilename()).toBe('知了1号-通信.log');
  await page.screenshot({path:'docs/screenshots/dashboard-amber.png'});
  await page.getByRole('button',{name:'切换日夜主题'}).click();await page.screenshot({path:'docs/screenshots/dashboard-night.png',animations:'disabled'});
  expect(errors).toEqual([]);
});
test('单页全部控制区在默认首屏内完整展示',async({page})=>{
  await page.goto('/');
  for(const viewport of [{width:1100,height:760},{width:1280,height:820},{width:1920,height:1080}]){
    await page.setViewportSize(viewport);
    for(const density of ['compact','comfortable']){
      await page.getByRole('button',{name:'设置',exact:true}).click();
      await page.getByRole('combobox',{name:'密度',exact:true}).selectOption(density);
      await page.getByRole('button',{name:'完成',exact:true}).click();
      expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
      const clipped=await page.locator('button, select, input:not([type=file]), textarea, .card-foot').evaluateAll(elements=>elements.filter(el=>{
        const r=el.getBoundingClientRect();if(!r.width||!r.height)return false;
        if(r.top<0||r.bottom>innerHeight+1||r.left<0||r.right>innerWidth+1)return true;
        const card=el.closest('.card');if(card){const c=card.getBoundingClientRect();if(r.bottom>c.bottom+1)return true;}
        if(el.matches('button, select, input, textarea')){const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(hit!==el&&!el.contains(hit))return true;}
        return false;
      }).map(el=>el.textContent?.slice(0,40)||el.getAttribute('aria-label')));
      expect(clipped).toEqual([]);
      for(const name of ['文本与提示音','语音参数','通信记录','发送预览'])await expect(page.getByRole('region',{name,exact:true})).toBeVisible();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
  }
  await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'docs/screenshots/dashboard-mobile.png',fullPage:true});
});
test('长文本自然完成后再续段，停止取消剩余队列',async({page})=>{
  await connect(page);await page.getByRole('combobox',{name:'编码',exact:true}).selectOption('5');await page.getByLabel('播报文本',{exact:true}).fill('中'.repeat(350));
  await page.getByRole('button',{name:'开始播报'}).click();await expect(page.getByText(/3 \/ 3 段已完成/)).toBeVisible({timeout:10000});
  await page.getByRole('button',{name:'开始播报'}).click();await page.getByRole('button',{name:'停止',exact:true}).click();await expect(page.getByText(/已停止 · 收到/)).toBeVisible();
});
test('设置弹窗延时校验、两种睡眠、版本查询、提示音与主题',async({page})=>{
  await connect(page);await page.getByRole('button',{name:'设置',exact:true}).click();const delays=page.getByRole('spinbutton');await delays.nth(0).fill('');await page.getByRole('button',{name:'保存延时'}).click();await expect(page.getByRole('alert')).toContainText('填写全部延时');
  await delays.nth(0).fill('200');await delays.nth(1).fill('250');await delays.nth(2).fill('300');await page.getByRole('button',{name:'保存延时'}).click();await expect(page.getByRole('status')).toContainText('延时参数已保存并读回');
  await page.getByRole('button',{name:'进入休眠',exact:true}).click();await expect(page.locator('.status-tag')).toHaveText('已休眠');
  await page.getByRole('button',{name:'唤醒模块'}).click();await page.getByRole('button',{name:'无回传睡眠',exact:true}).click();await expect(page.locator('.status-tag')).toHaveText('休眠待确认');await page.getByRole('button',{name:'唤醒模块'}).click();
  await page.getByRole('button',{name:'读取版本并断开'}).click();await expect(page.getByLabel('最近版本原始响应')).toContainText('58 53 49 4D');await page.getByRole('button',{name:'完成',exact:true}).click();await expect(page.getByRole('button',{name:'连接设备',exact:true})).toBeEnabled();
  await page.getByLabel('播报文本',{exact:true}).fill('您好');await page.getByLabel('播报文本',{exact:true}).press('End');await page.getByTitle('插入 [x1]sound901',{exact:true}).click();await expect(page.getByLabel('播报文本',{exact:true})).toHaveValue('您好 [x1]sound901 ');
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'林鸣 / Grove',exact:true}).click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','forest');
});
test('设置子窗口焦点、草稿保留、主题预览及小屏滚动',async({page})=>{
  await page.goto('/');await expect(page).toHaveTitle('知了1号 · CICADA-1');
  const trigger=page.getByRole('button',{name:'设置',exact:true});await trigger.click();
  const dialog=page.getByRole('dialog',{name:'设置',exact:true});const close=dialog.getByRole('button',{name:'关闭设置'});
  await expect(close).toBeFocused();await close.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'完成',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');await expect(close).toBeFocused();
  await dialog.getByLabel('上电 POP延时',{exact:true}).fill('12');await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
  await trigger.click();await expect(dialog.getByLabel('上电 POP延时',{exact:true})).toHaveValue('12');
  for(const [id,name] of [['amber','初鸣 / First Song'],['forest','林鸣 / Grove'],['night','夜鸣 / Nocturne'],['contrast','明翼 / Clearwing']]){
    await dialog.getByRole('button',{name,exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme',id);
    await expect(dialog.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');
    await page.screenshot({path:`docs/screenshots/settings-${id}.png`,animations:'disabled'});
  }
  await dialog.getByRole('combobox',{name:'动态效果'}).selectOption('reduced');await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
  for(const viewport of [{width:375,height:812},{width:812,height:375}]){
    await page.setViewportSize(viewport);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await dialog.getByRole('button',{name:'初鸣 / First Song',exact:true}).click();await expect(dialog.getByRole('button',{name:'完成',exact:true})).toBeInViewport();
  }
  await page.setViewportSize({width:375,height:812});await page.screenshot({path:'docs/screenshots/settings-mobile.png'});
  await dialog.getByRole('button',{name:'完成',exact:true}).click();await expect(trigger).toBeFocused();
});
