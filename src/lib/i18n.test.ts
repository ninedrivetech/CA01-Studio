import { expect, it } from 'vitest';
import { translate } from './i18n';
import { portLabel } from '../components/PortPicker';

it('翻译动态进度与错误，不改动原始文本或协议数据', () => {
  expect(translate('4 / 6 段已完成', 'en')).toBe('4 / 6 segments complete');
  expect(translate('COM9 已连接', 'en')).toBe('COM9 connected');
  expect(translate('Error: 请先连接设备', 'en')).toBe('Error: Connect a device first');
  expect(translate('FD 00 01 21', 'en')).toBe('FD 00 01 21');
  expect(translate('用户输入的中文内容', 'en')).toBe('用户输入的中文内容');
});
it('友好名称保留COM端口且不重复附加', () => {
  expect(portLabel({ name: 'COM9', description: 'USB-SERIAL CH340 (COM9)', manufacturer: 'wch.cn' })).toBe('USB-SERIAL CH340 (COM9)');
  expect(portLabel({ name: 'COM12', description: 'USB Serial Device', manufacturer: null })).toBe('USB Serial Device (COM12)');
});
