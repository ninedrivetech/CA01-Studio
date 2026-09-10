import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, Usb } from "lucide-react";
import type { PortInfo } from "../lib/device";
import { useI18n } from "../lib/i18n";

export function portLabel(port: PortInfo): string {
  return port.description.toLowerCase().includes(`(${port.name.toLowerCase()})`)
    ? port.description : `${port.description} (${port.name})`;
}

export function PortPicker({ ports, value, onChange, disabled }: {
  ports: PortInfo[]; value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState(value);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const selected = ports.find(port => port.name === value);
  const label = selected ? portLabel(selected) : value || t("选择串口");
  const filtered = ports.filter(port => `${portLabel(port)} ${port.manufacturer ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const manualValid = /^COM\d+$/i.test(manual.trim()) || /^\/dev\/\S+$/.test(manual.trim());
  function close() { setOpen(false); trigger.current?.focus(); }
  function choose(name: string) { onChange(name); setManual(name); close(); }
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const animation = requestAnimationFrame(() => document.getElementById(`port-option-${active}`)?.scrollIntoView({ block: "nearest" }));
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => { cancelAnimationFrame(animation); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => { setActive(index => Math.min(index, Math.max(0, filtered.length - 1))); }, [filtered.length]);

  return <div className="port-picker" ref={root} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <span id="port-label">{t("端口")}</span>
    <button ref={trigger} type="button" className="port-trigger" role="combobox" aria-labelledby="port-label"
      aria-expanded={open} aria-controls="port-options" aria-haspopup="listbox" disabled={disabled} title={label}
      onClick={() => { setQuery(""); setManual(value); setActive(Math.max(0, ports.findIndex(port => port.name === value))); setOpen(!open); }}
      onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setQuery(""); setManual(value); setActive(Math.max(0, ports.findIndex(port => port.name === value))); setOpen(true); } }}>
      <Usb size={15} /><span>{label}</span><ChevronDown size={14} />
    </button>
    {open && <div className="port-popup">
      <div className="port-search"><Search size={15} /><input ref={search} aria-label={t("搜索串口设备")}
        placeholder={t("搜索设备名称或 COM 口")} value={query} aria-controls="port-options"
        aria-activedescendant={filtered[active] ? `port-option-${active}` : undefined}
        onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); const next = Math.max(0, Math.min(filtered.length - 1, active + (event.key === "ArrowDown" ? 1 : -1)));
            setActive(next); document.getElementById(`port-option-${next}`)?.scrollIntoView({ block: "nearest" });
          }
          if (event.key === "Enter" && filtered[active]) { event.preventDefault(); choose(filtered[active].name); }
        }} /></div>
      <div id="port-options" role="listbox" aria-label={t("可用串口")} className="port-options">
        {filtered.map((port, index) => <button type="button" role="option" id={`port-option-${index}`} key={port.name}
          aria-selected={port.name === value} className={active === index ? "highlighted" : ""}
          onPointerMove={() => setActive(index)} onClick={() => choose(port.name)}>
          <Usb size={17} /><span><strong>{portLabel(port)}</strong><small>{port.manufacturer || t("串口设备")}</small></span>
          {port.name === value && <Check size={16} />}
        </button>)}
      </div>
      {!filtered.length && <p className="port-empty">{t(ports.length ? "没有匹配的设备" : "未发现串口，可刷新或手动输入")}</p>}
      <div className="port-manual"><label>{t("手动指定端口")}<input placeholder={t("选择或输入 COM 口")} value={manual}
        onChange={event => setManual(event.target.value)} onKeyDown={event => {
          if (event.key === "Enter" && manualValid) { event.preventDefault(); choose(manual.trim().replace(/^com/i, "COM")); }
        }} /></label><button type="button" disabled={!manualValid} onClick={() => choose(manual.trim().replace(/^com/i, "COM"))}>{t("使用端口")}</button></div>
    </div>}
  </div>;
}
