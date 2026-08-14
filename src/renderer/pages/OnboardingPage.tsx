import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, KeyRound, Landmark, LineChart } from 'lucide-react';
import { errorMessage } from '../format';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [apiKey, setApiKey] = useState('');
  const [platform, setPlatform] = useState('');
  const [test, setTest] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function testKey() {
    if (!apiKey) return;
    setBusy(true); setTest('');
    const result = await window.stockEarn.settings.testQuoteProvider(apiKey);
    setTest(result.message); setBusy(false);
  }

  async function finish(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await window.stockEarn.settings.update({ startDate, apiKey: apiKey || null, initialized: true });
      await window.stockEarn.platforms.create({ name: platform });
      onComplete();
    } catch (reason) { setError(errorMessage(reason)); setBusy(false); }
  }

  return <div className="onboarding">
    <div className="onboarding-visual">
      <div className="window-drag" />
      <div className="onboarding-brand"><div className="brand-mark">SE</div><span>Stock Earn</span></div>
      <div className="visual-copy"><p>从第一笔交易开始</p><h1>把赚到的每一美元，<br />算得清清楚楚。</h1></div>
      <div className="ledger-demo"><span>{startDate}</span><i /><strong>今天</strong><div>净盈亏会沿着这条时间线累积</div></div>
      <small>纯本地 · 美股 · USD</small>
    </div>
    <div className="onboarding-form">
      <div className="setup-progress">{[1, 2, 3].map((value) => <span key={value} className={value <= step ? 'active' : ''}>{value < step ? <Check size={13} /> : value}</span>)}</div>
      {step === 1 && <section><LineChart className="step-icon" /><p className="eyebrow">第一步</p><h2>从哪一天开始计算？</h2><p className="muted">这一天会成为账本的统计起点，之后不能晚于已有交易。</p><label>入市起始日<Input type="date" value={startDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setStartDate(e.target.value)} /></label><Button variant="primary" className="full" onClick={() => setStep(2)} disabled={!startDate}>继续 <ArrowRight size={17} /></Button></section>}
      {step === 2 && <section><KeyRound className="step-icon" /><p className="eyebrow">第二步</p><h2>连接最新参考价</h2><p className="muted">填写 Twelve Data API Key。Key 会由 Windows 加密保存，也可以稍后再设置。</p><label>API Key<Input type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setTest(''); }} placeholder="粘贴你的 Twelve Data API Key" /></label>{test && <div className="test-result">{test}</div>}<div className="button-row"><Button variant="ghost" onClick={() => setStep(1)}>返回</Button><Button variant="secondary" onClick={testKey} disabled={!apiKey || busy}>{busy ? '测试中…' : '测试连接'}</Button><Button variant="primary" onClick={() => setStep(3)}>{apiKey ? '继续' : '暂时跳过'} <ArrowRight size={17} /></Button></div></section>}
      {step === 3 && <form onSubmit={finish}><section><Landmark className="step-icon" /><p className="eyebrow">最后一步</p><h2>添加第一个交易平台</h2><p className="muted">平台只用于区分持仓和手续费，例如 IBKR、富途或嘉信。</p><label>平台名称<Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="例如 IBKR" autoFocus /></label>{error && <div className="inline-error">{error}</div>}<div className="button-row"><Button type="button" variant="ghost" onClick={() => setStep(2)}>返回</Button><Button variant="primary" disabled={!platform.trim() || busy}>{busy ? '正在创建…' : '打开我的账本'} <ArrowRight size={17} /></Button></div></section></form>}
    </div>
  </div>;
}
