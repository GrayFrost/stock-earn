import { useEffect, useState, type FormEvent } from 'react';
import { Archive, CheckCircle2, DatabaseBackup, KeyRound, Landmark, Palette, Plus, RotateCcw, Save, Type } from 'lucide-react';
import type { AppSettings, FontSize, Platform } from '../../shared/types';
import { errorMessage } from '../format';
import { clearStoredFontSize, resolveFontSize, storeFontSize } from '../fontSize';
import { DatePicker } from '../components/DatePicker';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Input } from '../components/ui/input';

const normalizeSettings = (settings: AppSettings): AppSettings => ({ ...settings, fontSize: resolveFontSize(settings.fontSize) });

export function SettingsPage({ onSettingsChange }: { onSettingsChange: (settings: AppSettings) => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null); const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [startDate, setStartDate] = useState(''); const [colorMode, setColorMode] = useState<'us' | 'cn'>('us'); const [fontSize, setFontSize] = useState<FontSize>('base'); const [apiKey, setApiKey] = useState(''); const [newPlatform, setNewPlatform] = useState('');
  const [notice, setNotice] = useState(''); const [busy, setBusy] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(false);
  const load = () => Promise.all([window.stockEarn.settings.get(), window.stockEarn.platforms.list(true)]).then(([rawSettings, nextPlatforms]) => { const nextSettings = normalizeSettings(rawSettings); setSettings(nextSettings); setStartDate(nextSettings.startDate ?? ''); setColorMode(nextSettings.colorMode); setFontSize(nextSettings.fontSize); setPlatforms(nextPlatforms); });
  useEffect(() => { void load(); }, []);

  async function selectFontSize(nextFontSize: FontSize) {
    if (!settings || nextFontSize === fontSize || busy === 'font') return;
    const previousSettings = settings;
    const previewSettings = { ...settings, fontSize: nextFontSize };
    storeFontSize(nextFontSize); setFontSize(nextFontSize); setSettings(previewSettings); onSettingsChange(previewSettings); setBusy('font'); setNotice('');
    try {
      const savedSettings = normalizeSettings(await window.stockEarn.settings.update({ fontSize: nextFontSize }));
      setSettings(savedSettings); onSettingsChange(savedSettings);
    } catch (reason) {
      storeFontSize(previousSettings.fontSize); setFontSize(previousSettings.fontSize); setSettings(previousSettings); onSettingsChange(previousSettings); setNotice(errorMessage(reason));
    } finally { setBusy(''); }
  }
  async function saveGeneral() { setBusy('general'); setNotice(''); try { const next = normalizeSettings(await window.stockEarn.settings.update({ startDate, colorMode, fontSize })); setSettings(next); onSettingsChange(next); setNotice('设置已保存'); } catch (reason) { setNotice(errorMessage(reason)); } finally { setBusy(''); } }
  async function saveKey() { setBusy('key'); setNotice(''); try { if (apiKey) { const test = await window.stockEarn.settings.testQuoteProvider(apiKey); if (!test.ok) throw new Error(test.message); } const next = normalizeSettings(await window.stockEarn.settings.update({ apiKey: apiKey || null })); setSettings(next); onSettingsChange(next); setApiKey(''); setNotice(apiKey ? 'API Key 已测试并加密保存' : 'API Key 已移除'); } catch (reason) { setNotice(errorMessage(reason)); } finally { setBusy(''); } }
  async function addPlatform(event: FormEvent) { event.preventDefault(); if (!newPlatform.trim()) return; try { await window.stockEarn.platforms.create({ name: newPlatform }); setNewPlatform(''); await load(); } catch (reason) { setNotice(errorMessage(reason)); } }
  async function togglePlatform(platform: Platform) { await window.stockEarn.platforms.archive({ id: platform.id, archived: !platform.archived }); await load(); }
  async function exportBackup() { setBusy('backup'); try { const result = await window.stockEarn.backup.export(); if (result.path) setNotice(`备份已保存到 ${result.path}`); } catch (reason) { setNotice(errorMessage(reason)); } finally { setBusy(''); } }
  async function restoreBackup() { setBusy('restore'); try { const result = await window.stockEarn.backup.restore(); if (result.restored) { clearStoredFontSize(); window.location.reload(); } } catch (reason) { setNotice(errorMessage(reason)); } finally { setBusy(''); } }
  if (!settings) return <div className="page-loading"><span /><p>正在读取设置…</p></div>;
  return <div className="page settings-page"><header className="page-header"><div><p className="eyebrow">LEDGER SETTINGS</p><h1>设置</h1><p>管理账本起点、交易平台和本地数据。</p></div></header>{notice && <div className="notice-bar">{notice}</div>}
    <div className="settings-grid">
      <section className="settings-card"><div className="settings-card-title"><Landmark /><div><h2>账本规则</h2><p>起始日不能晚于已有交易。</p></div></div><div className="form-stack"><label>入市起始日<DatePicker value={startDate} onChange={setStartDate} max={new Date().toISOString().slice(0, 10)} ariaLabel="选择入市起始日" /></label><Button variant="primary" className="align-self" onClick={saveGeneral} disabled={busy === 'general'}><Save size={16} />{busy === 'general' ? '保存中…' : '保存账本规则'}</Button></div></section>
      <section className="settings-card"><div className="settings-card-title"><Palette /><div><h2>盈亏颜色</h2><p>买卖标记始终使用蓝色和橙色。</p></div></div><div className="color-options"><button className={colorMode === 'us' ? 'active' : ''} onClick={() => setColorMode('us')}><span><i className="profit-swatch" />盈利绿色</span><small>美股习惯 · 推荐</small></button><button className={colorMode === 'cn' ? 'active' : ''} onClick={() => setColorMode('cn')}><span><i className="loss-swatch" />盈利红色</span><small>中国市场习惯</small></button></div><Button variant="secondary" className="align-self" onClick={saveGeneral}><Save size={16} />保存显示偏好</Button></section>
      <section className="settings-card span-two"><div className="settings-card-title"><Type /><div><h2>字体大小</h2><p>放大界面中的正文、表格数字和标题，选择后自动保存。</p></div></div><div className="font-size-options">{([
        ['base', '基础', '默认尺寸'],
        ['comfortable', '舒适', '放大 8%'],
        ['large', '较大', '放大 16%'],
        ['extra-large', '特大', '放大 24%'],
      ] as const).map(([value, label, hint]) => <button type="button" key={value} className={fontSize === value ? 'active' : ''} aria-pressed={fontSize === value} disabled={busy === 'font'} onClick={() => void selectFontSize(value)}><span className={`font-size-option-preview preview-${value}`}>Aa</span><span><strong>{label}</strong><small>{hint}</small></span>{fontSize === value && <span className="font-size-current"><CheckCircle2 size={12} />{busy === 'font' ? '保存中' : '当前'}</span>}</button>)}</div></section>
      <section className="settings-card span-two"><div className="settings-card-title"><KeyRound /><div><h2>最新参考价</h2><p>Twelve Data API Key 由 Windows 加密保存，不会写入备份。</p></div>{settings.hasApiKey && <span className="status-badge"><CheckCircle2 size={14} />已连接</span>}</div><div className="inline-form"><Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={settings.hasApiKey ? '输入新 Key 可替换；留空保存将移除' : '粘贴 Twelve Data API Key'} /><Button variant="secondary" onClick={saveKey} disabled={busy === 'key'}>{busy === 'key' ? '测试中…' : settings.hasApiKey ? '更新 Key' : '测试并保存'}</Button></div></section>
      <section className="settings-card span-two"><div className="settings-card-title"><Landmark /><div><h2>交易平台</h2><p>已发生交易的平台归档后仍会保留在历史记录中。</p></div></div><form className="inline-form" onSubmit={addPlatform}><Input value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} placeholder="添加平台，例如 IBKR" /><Button variant="primary"><Plus size={16} />添加</Button></form><div className="platform-list">{platforms.map((platform) => <div key={platform.id} className={platform.archived ? 'archived' : ''}><span className="platform-avatar">{platform.name.slice(0, 2).toUpperCase()}</span><strong>{platform.name}</strong><small>{platform.archived ? '已归档' : '使用中'}</small><Button variant="ghost" size="sm" onClick={() => togglePlatform(platform)}>{platform.archived ? <><RotateCcw size={14} />恢复</> : <><Archive size={14} />归档</>}</Button></div>)}</div></section>
      <section className="settings-card span-two"><div className="settings-card-title"><DatabaseBackup /><div><h2>本地备份</h2><p>导出交易、行情缓存和设置；API Key 不包含在内。</p></div></div><div className="backup-actions"><Button variant="secondary" onClick={exportBackup} disabled={busy === 'backup'}><DatabaseBackup size={16} />{busy === 'backup' ? '导出中…' : '导出备份'}</Button><Button variant="danger" onClick={() => setConfirmRestore(true)} disabled={busy === 'restore'}><RotateCcw size={16} />{busy === 'restore' ? '恢复中…' : '从备份恢复'}</Button></div></section>
    </div>
    <ConfirmDialog open={confirmRestore} onOpenChange={setConfirmRestore} title="从备份恢复账本？" description="恢复操作会替换当前账本。选择备份文件后，应用会先自动保存一份恢复前数据。" confirmText="选择备份并恢复" onConfirm={restoreBackup} />
  </div>;
}
