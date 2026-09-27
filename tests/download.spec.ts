import { expect, test } from '@playwright/test';

test('桌面导出在主题弹窗内处理目录重试、保存失败和成功，不触发浏览器下载', async ({ page }) => {
  await page.addInitScript(() => {
    let saves = 0;
    Object.assign(window, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        metadata: { currentWindow: { label: 'main' } },
        invoke: async (command: string, args: { filename: string; content: string }) => {
          if (command === 'ports') return [];
          if (command === 'log_export_directory') {
            if (!(window as unknown as { directoryAvailable?: boolean }).directoryAvailable) throw '无法获取下载目录，请检查系统设置后重试';
            return 'C:\\Users\\Example\\Downloads';
          }
          if (command === 'save_log_export') {
            await new Promise(resolve => setTimeout(resolve, 600));
            if (++saves === 1) throw '无法保存日志，请检查下载目录权限和磁盘空间后重试';
            Object.assign(window, { savedLog: args });
            return 'C:\\Users\\Example\\Downloads\\通信 (1).log';
          }
        },
      },
    });
    localStorage.setItem('zhiliao.theme', 'night');
  });
  const downloads: string[] = [];
  page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.goto('/');
  await page.getByRole('combobox', { name: '通道', exact: true }).selectOption('sim');
  await page.getByRole('button', { name: '连接设备', exact: true }).click();
  await expect(page.getByText('已从模块读取')).toBeVisible();
  const trigger = page.getByRole('button', { name: '导出日志', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '导出日志', exact: true });
  await expect(dialog.getByRole('alert')).toContainText('无法获取下载目录');
  await expect(dialog.getByRole('button', { name: '下载文件' })).toBeDisabled();
  await page.evaluate(() => Object.assign(window, { directoryAvailable: true }));
  await dialog.getByRole('button', { name: '重新获取保存位置' }).click();
  await expect(dialog).toContainText('C:\\Users\\Example\\Downloads');
  await dialog.getByLabel('文件名', { exact: true }).fill('../invalid');
  await dialog.getByRole('button', { name: '下载文件' }).click();
  await expect(dialog.getByRole('alert')).toContainText('请输入有效文件名');
  await dialog.getByLabel('文件名', { exact: true }).fill('通信');
  const snapshot = await dialog.getByLabel('日志内容预览').textContent();
  await dialog.getByRole('button', { name: '下载文件' }).click();
  await expect(dialog.getByRole('button', { name: '正在保存…' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '关闭下载弹窗' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('无法保存日志');
  await dialog.getByRole('button', { name: '下载文件' }).click();
  await expect(dialog.getByRole('status')).toContainText('文件已保存');
  await expect(dialog.getByRole('status')).toContainText('通信 (1).log');
  const saved = await page.evaluate(() => (window as unknown as { savedLog: { filename: string; content: string } }).savedLog);
  expect(saved.filename).toBe('通信.log');
  expect(saved.content).toContain(snapshot!);
  expect(downloads).toEqual([]);
  await expect(dialog.getByRole('button', { name: '完成', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByLabel('文件名', { exact: true })).toHaveValue('知了1号-通信');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('英文导出弹窗在小窗口中保持可用', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('zhiliao.language', 'en'));
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Export logs', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export logs', exact: true });
  await expect(dialog).toContainText("Your browser's download folder");
  await expect(dialog.getByLabel('File name', { exact: true })).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
