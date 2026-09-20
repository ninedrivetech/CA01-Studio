import { expect, test } from '@playwright/test';

test('日志下载弹窗跟随四种主题，支持取消和空结果', async ({ page }) => {
  await page.goto('/');
  const colors = new Set<string>();
  for (const theme of ['amber', 'forest', 'night', 'contrast']) {
    await page.evaluate(value => localStorage.setItem('zhiliao.theme', value), theme);
    await page.reload();
    const trigger = page.getByRole('button', { name: '导出日志', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '导出日志' });
    await expect(dialog).toBeVisible();
    colors.add(await dialog.evaluate(element => getComputedStyle(element).backgroundColor));
    await expect(dialog.getByText('知了1号-通信.log')).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/download-${theme}.png`, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
  expect(colors.size).toBe(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '清空日志', exact: true }).click();
  await page.getByRole('button', { name: '导出日志', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '下载文件' })).toBeDisabled();
  await expect(dialog.getByRole('status')).toContainText('没有可导出的日志');
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test('最小窗口高度下工作台控件未被卡片裁切', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto('/');
  for (const language of ['zh', 'en']) {
      await page.evaluate((language) => {
        localStorage.setItem('zhiliao.language', language);
      }, language);
      await page.reload();
      const clipped = await page.locator('.card button, .card select, .card textarea, .card-foot').evaluateAll(elements =>
    elements.filter(element => {
      const rect = element.getBoundingClientRect();
      const card = element.closest('.card')!.getBoundingClientRect();
      return rect.top < card.top || rect.bottom > card.bottom;
    }).map(element => element.textContent || element.getAttribute('aria-label')));
      expect(clipped, language).toEqual([]);
  }
});

test('严格导入保留旧草稿，长文本预览可以逐段切换', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByLabel('播报文本', { exact: true });
  await editor.fill('保留我的草稿');
  await page.getByLabel('导入文本', { exact: true }).setInputFiles({
    name: 'gbk.txt', mimeType: 'text/plain', buffer: Buffer.from([0xd6, 0xd0]),
  });
  await expect(page.getByRole('alert')).toContainText('不是有效的 UTF-8');
  await expect(editor).toHaveValue('保留我的草稿');
  await page.getByRole('button', { name: '关闭提示' }).click();
  await page.getByRole('combobox', { name: '编码', exact: true }).selectOption('5');
  await page.getByLabel('导入文本', { exact: true }).setInputFiles({
    name: 'valid.txt', mimeType: 'text/plain', buffer: Buffer.from('中'.repeat(150) + '结尾'),
  });
  const preview = page.getByRole('region', { name: '发送预览', exact: true });
  await expect(preview).toContainText('1 / 2');
  const first = await preview.locator('pre').textContent();
  await page.getByRole('button', { name: '下一段', exact: true }).click();
  await expect(preview).toContainText('2 / 2');
  expect(await preview.locator('pre').textContent()).not.toBe(first);
  await page.getByRole('button', { name: '上一段', exact: true }).click();
  await expect(preview.locator('pre')).toHaveText(first!);
  await editor.fill('');
  await expect(preview).toContainText('无可发送报文');
  await expect(preview).not.toContainText('1 / 0');
});

test('后台编码只展示最新文本，刷新保留最新草稿', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '连接设备', exact: true }).click();
  await expect(page.getByText('已从模块读取')).toBeVisible();
  await page.getByRole('combobox', { name: '编码', exact: true }).selectOption('5');
  const editor = page.getByLabel('播报文本', { exact: true });
  await editor.fill('长文本。'.repeat(40000));
  await expect(page.getByRole('button', { name: '开始播报' })).toBeDisabled();
  await editor.fill('短');
  await expect(page.getByRole('button', { name: '开始播报' })).toBeEnabled();
  await expect(page.locator('.preview pre')).toHaveText('FD 00 05 01 05 E7 9F AD');
  await editor.fill('关闭前的最新草稿');
  await page.reload();
  await expect(editor).toHaveValue('关闭前的最新草稿');
});

test('日志空筛选可恢复，展开模式与播放进度可用', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '连接设备', exact: true }).click();
  await expect(page.getByText('已从模块读取')).toBeVisible();
  await page.getByLabel('搜索日志').fill('no-such-message');
  await expect(page.getByText('无匹配记录', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(page.locator('.log-row').first()).toBeVisible();
  await page.getByRole('button', { name: '展开日志' }).click();
  await expect(page.getByRole('button', { name: '收起日志' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: '开始播报' }).click();
  await expect(page.getByRole('progressbar', { name: '播报进度' })).toHaveJSProperty('value', 1);
  await page.screenshot({ path: 'docs/screenshots/optimized-logs.png', fullPage: true });
});

test('关于信息完整展示，中英文与手机操作布局可用', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const about = page.getByRole('region', { name: '关于', exact: true });
  await expect(about).toContainText('Mzee');
  await expect(about).toContainText('上海玖驱科技有限公司');
  await expect(about.getByRole('link', { name: 'xiemaths@outlook.com' })).toHaveAttribute('href', 'mailto:xiemaths@outlook.com');
  await about.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/screenshots/optimized-about.png' });
  await page.getByRole('combobox', { name: '界面语言', exact: true }).selectOption('en');
  await expect(page.getByRole('region', { name: 'About', exact: true })).toContainText('Mzee');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const small = await page.locator('.studio-main button, .header-actions button').evaluateAll(elements =>
    elements.filter(element => element.getBoundingClientRect().height < 44).map(element => element.getAttribute('aria-label') || element.textContent));
  expect(small).toEqual([]);
  await page.screenshot({ path: 'docs/screenshots/optimized-mobile.png', fullPage: true });
});

test('文本校验提示与输入关联，日志暂停有可访问状态', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByLabel('播报文本', { exact: true });
  await editor.fill('😀');
  await expect(editor).toHaveAttribute('aria-invalid', 'true');
  await expect(editor).toHaveAccessibleDescription(/补充平面字符/);
  await editor.fill('您好');
  await expect(editor).toHaveAttribute('aria-invalid', 'false');
  const freeze = page.getByRole('button', { name: '暂停显示', exact: true });
  await freeze.click();
  await expect(freeze).toHaveAttribute('aria-pressed', 'true');
  await freeze.click();
  await expect(freeze).toHaveAttribute('aria-pressed', 'false');
});
