'use client';

import { useState } from 'react';
import { Check, X, Sparkles, Zap, Rocket, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export type PlanId = 'free' | 'basic' | 'deep' | 'season';

interface PlanOption {
  id: PlanId;
  name: string;
  price: string;
  desc: string;
  features: string[];
  icon: typeof Sparkles;
  highlight?: boolean;
}

interface PricingModalProps {
  currentPlan: string;
  onPlanUpgraded?: (plan: Exclude<PlanId, 'free'>, expiresAt: string) => void;
  onClose: () => void;
}

const plans: PlanOption[] = [
  {
    id: 'free',
    name: '免费体验',
    price: '0',
    desc: '先试一次检测，确认效果',
    features: ['1 次全文/章节检测', '检测报告', '本地项目保存'],
    icon: Sparkles,
  },
  {
    id: 'basic',
    name: '单篇基础',
    price: '19.9',
    desc: '适合普通论文润色',
    features: ['检测 + 修改', '智能润色', '降 AI 痕迹', 'docx 导出'],
    icon: Zap,
  },
  {
    id: 'deep',
    name: '单篇深度',
    price: '39.9',
    desc: '适合需要深度审查的论文',
    features: ['基础版全部功能', '逻辑重构', '格式校验', '引用检查'],
    icon: Rocket,
    highlight: true,
  },
  {
    id: 'season',
    name: '毕业季通行证',
    price: '99',
    desc: '整个毕业季不限次数',
    features: ['无限次检测', '无限次修改', '全部材料模板', '优先体验新功能'],
    icon: Rocket,
  },
];

export default function PricingModal({
  currentPlan,
  onPlanUpgraded,
  onClose,
}: PricingModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRedeem = async () => {
    setError('');
    setSuccess('');
    if (!selectedPlan || selectedPlan === 'free') return;
    if (!code.trim()) {
      setError('请输入激活码');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '兑换失败');
      } else {
        setSuccess(data.message || '开通成功');
        onPlanUpgraded?.(selectedPlan, data.expiresAt);
        setTimeout(() => onClose(), 1200);
      }
    } catch (err) {
      setError('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-theme-backdrop backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-theme-card border border-theme-medium rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-theme-card/95 backdrop-blur border-b border-theme-subtle px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-theme-primary">选择套餐</h2>
            <p className="text-[11px] text-theme-faint mt-0.5">
              当前套餐：{currentPlan === 'free' ? '免费体验' : currentPlan}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-theme-dim hover:text-theme-tertiary hover:bg-theme-surface-4 transition-colors"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plans.map(plan => {
              const isCurrent = plan.id === currentPlan;
              const isSelected = selectedPlan === plan.id;
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  onClick={() => plan.id !== 'free' && setSelectedPlan(plan.id)}
                  className={`rounded-xl border p-5 cursor-pointer transition-all ${
                    plan.highlight
                      ? 'border-cyan-500/20 bg-cyan-500/[0.04]'
                      : 'border-theme-subtle bg-theme-surface-2'
                  } ${isSelected ? 'ring-2 ring-cyan-500/40' : 'hover:border-cyan-500/20'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/10 flex items-center justify-center">
                        <Icon size={16} className="text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-theme-secondary">{plan.name}</div>
                        <div className="text-[11px] text-theme-faint mt-0.5">{plan.desc}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-theme-primary">¥{plan.price}</div>
                      <div className="text-[10px] text-theme-faint">/ 使用范围</div>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-1.5">
                    {plan.features.map(feature => (
                      <li key={feature} className="flex items-center gap-2 text-xs text-theme-muted">
                        <Check size={12} className="text-cyan-400 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrent && (
                    <div className="mt-5 w-full rounded-xl py-2.5 text-xs font-semibold text-center bg-theme-surface-4 text-theme-faint">
                      当前套餐
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedPlan && selectedPlan !== 'free' && (
            <div className="mt-5 rounded-xl border border-cyan-500/10 bg-cyan-500/[0.03] p-4">
              <p className="text-xs text-theme-secondary mb-3">
                已选套餐：{selectedPlan === 'basic' ? '单篇基础 ¥19.9' : selectedPlan === 'deep' ? '单篇深度 ¥39.9' : '毕业季通行证 ¥99'}
              </p>
              <p className="text-[11px] text-theme-dim mb-3 leading-relaxed">
                添加客服微信转账后获取激活码，在此输入即可开通。激活码区分大小写。
              </p>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="输入激活码"
                className="w-full bg-theme-page rounded-xl px-3 py-2.5 text-sm border border-theme-subtle focus:border-cyan-500/30 outline-none mb-3 tracking-widest uppercase"
                onKeyDown={e => e.key === 'Enter' && handleRedeem()}
              />
              {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
              {success && <p className="text-xs text-emerald-500 mb-3">{success}</p>}
              <button
                onClick={handleRedeem}
                disabled={loading || !code.trim()}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 disabled:opacity-30 text-white rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : '立即开通'}
              </button>
            </div>
          )}

          <p className="text-[11px] text-theme-faint text-center mt-5 leading-relaxed">
            付款后请妥善保存激活码，一经兑换即绑定当前账号，不可转让。
          </p>
        </div>
      </div>
    </div>
  );
}
