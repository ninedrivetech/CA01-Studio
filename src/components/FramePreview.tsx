import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { hex } from '../lib/protocolCore';
import { useI18n } from '../lib/i18n';

export function FramePreview({ frames, preparing }: { frames: number[][]; preparing: boolean }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, frames.length - 1));
  const current = frames[index];
  return <section className="card preview" aria-label={t('发送预览')}>
    <div className="card-heading">
      <h2>{t('发送预览')}</h2>
      <div className="preview-navigation">
        <button className="icon-button" aria-label={t('上一段')} disabled={!current || index === 0}
          onClick={() => setSelected(index - 1)}><ChevronLeft size={14} /></button>
        <span>{current ? `${index + 1} / ${frames.length}` : '0 / 0'}</span>
        <button className="icon-button" aria-label={t('下一段')} disabled={!current || index === frames.length - 1}
          onClick={() => setSelected(index + 1)}><ChevronRight size={14} /></button>
      </div>
    </div>
    <pre>{current ? hex(current) : t(preparing ? '正在准备文本…' : '无可发送报文')}</pre>
    <div className="card-foot">{current ? `${current.length - 5} B · ` : ''}{t('FD 帧头 · 大端长度 · 01 合成 · 编码 + 文本')}</div>
  </section>;
}
