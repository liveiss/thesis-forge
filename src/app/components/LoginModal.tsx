'use client';

import { useState } from 'react';
import { ArrowRight, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { sendCode, verifyCode } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const handleSendCode = async () => {
    setError('');
    setLoading(true);
    const res = await sendCode(phone);
    setLoading(false);
    if (res.ok) {
      setStep('code');
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
    } else {
      setError(res.error || '发送失败');
    }
  };

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    const res = await verifyCode(phone, code);
    setLoading(false);
    if (res.ok) {
      onClose();
    } else {
      setError(res.error || '验证失败');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-theme-backdrop backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-theme-card rounded-2xl border border-theme-medium p-6 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-theme-secondary">
            {step === 'phone' ? '手机号登录' : '输入验证码'}
          </h2>
          <button onClick={onClose} className="text-theme-dim hover:text-theme-tertiary transition-colors">
            <X size={16} />
          </button>
        </div>

        {step === 'phone' ? (
          <>
            <div className="flex items-center gap-2 mb-4 bg-theme-page rounded-xl border border-theme-subtle px-3">
              <span className="text-xs text-theme-dim px-1">+86</span>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="手机号"
                className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-theme-faint"
                onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <button
              onClick={handleSendCode}
              disabled={loading || phone.length !== 11}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 disabled:opacity-30 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <><span>获取验证码</span><ArrowRight size={14} /></>}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-theme-dim mb-4">已发送至 +86 {phone}</p>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 位验证码"
              className="w-full text-center text-2xl tracking-[0.5em] bg-theme-page rounded-xl px-3 py-3 text-sm border border-theme-subtle focus:border-cyan-500/30 outline-none mb-4"
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              autoFocus
            />
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 disabled:opacity-30 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : '登录'}
            </button>
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setStep('phone')} className="text-xs text-theme-dim hover:text-theme-tertiary transition-colors">← 换手机号</button>
              <button
                onClick={handleSendCode}
                disabled={countdown > 0}
                className="text-xs text-cyan-400 hover:text-cyan-300 disabled:text-theme-faint transition-colors"
              >
                {countdown > 0 ? `${countdown}s 后重发` : '重新发送'}
              </button>
            </div>
            <p className="text-[10px] text-theme-faint text-center mt-3">开发阶段验证码在浏览器控制台 (F12)</p>
          </>
        )}

        <p className="text-[10px] text-theme-faint text-center mt-4 leading-relaxed">
          登录即同意
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">《用户协议》</a>
          和
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">《隐私政策》</a>
          <br />
          本工具提供论文辅助修改服务，不提供代写
        </p>
      </div>
    </div>
  );
}
