import { test, expect } from '@playwright/test';

test('完整英文界面、运行状态和日志，切换保留草稿与设备参数', async ({ page }) => {
  await page.goto('/');
  const text = '保留这段中文测试文本。';
  await page.getByLabel('播报文本', { exact: true }).fill(text);
  await page.getByRole('combobox', { name: '发音人', exact: true }).selectOption('56');
  await page.getByRole('button', { name: 'Switch language / 切换语言' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Cicada One · CICADA-1');
  await expect(page.getByLabel('Speech text', { exact: true })).toHaveValue(text);
  await expect(page.getByRole('combobox', { name: 'Voice', exact: true })).toHaveValue('56');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByText('Synced from device')).toBeVisible();
  await page.getByRole('button', { name: 'Speak', exact: true }).click();
  await expect(page.getByText(/1 \/ 1 segments complete/)).toBeVisible();
  await expect(page.locator('.log-row').filter({ hasText: 'Device reply' }).first()).toBeVisible();
  const untranslated = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const found: string[] = []; let node: Node | null;
    while ((node = walker.nextNode())) {
      const element = node.parentElement;
      if (!element || element.closest('textarea, script, option, svg') || !element.getClientRects().length) continue;
      if (/[\u3400-\u9fff]/u.test(node.textContent ?? '')) found.push(node.textContent!.trim());
    }
    return found;
  });
  expect(untranslated).toEqual([]);
  await page.screenshot({ path: 'docs/screenshots/dashboard-en.png', animations: 'disabled' });
  for (const viewport of [{ width: 1100, height: 760 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeInViewport();
  }
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(dialog.getByRole('heading', { name: 'Device settings', exact: true })).toBeVisible();
  await dialog.getByLabel('Power-on POP delay', { exact: true }).fill('');
  await dialog.getByRole('button', { name: 'Save delays', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Enter all delay values');
  await dialog.getByLabel('Power-on POP delay', { exact: true }).fill('0');
  await dialog.getByRole('button', { name: 'Save delays', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Delays saved and read back');
  await dialog.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.screenshot({ path: 'docs/screenshots/settings-en.png', animations: 'disabled' });
  await dialog.getByRole('combobox', { name: 'Interface language', exact: true }).selectOption('zh');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.getByLabel('播报文本', { exact: true })).toHaveValue(text);
  await page.getByRole('button', { name: 'Switch language / 切换语言' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
});

test('完整串口名称、搜索、键盘选择与手动串口', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { isTauri: true, __TAURI_INTERNALS__: { metadata: { currentWindow: { label: 'main' } }, invoke: async (command: string) => command === 'ports' ? [
      { name: 'COM9', description: 'USB-SERIAL CH340 (COM9)', manufacturer: 'wch.cn' },
      { name: 'COM12', description: 'USB Serial Device', manufacturer: 'Example' },
    ] : undefined } });
  });
  await page.goto('/');
  const port = page.getByRole('combobox', { name: '端口', exact: true });
  await expect(port).toContainText('USB-SERIAL CH340 (COM9)');
  await port.click();
  await expect(page.getByRole('option', { name: /USB Serial Device \(COM12\)/ })).toBeVisible();
  await page.getByLabel('搜索串口设备').fill('COM12');
  await page.getByLabel('搜索串口设备').press('Enter');
  await expect(port).toContainText('USB Serial Device (COM12)');
  await expect(port).toBeFocused();
  await port.press('ArrowDown');
  await page.getByLabel('搜索串口设备').fill('missing');
  await expect(page.getByText('没有匹配的设备')).toBeVisible();
  await page.getByPlaceholder('选择或输入 COM 口').fill('com88');
  await page.getByRole('button', { name: '使用端口', exact: true }).click();
  await expect(port).toContainText('COM88');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('zhiliao.port'))).toBe('COM88');
  await port.click();
  await page.getByLabel('搜索串口设备').press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(port).toBeFocused();
  await expect(port).toHaveAttribute('aria-expanded', 'false');
});
