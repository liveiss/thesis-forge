import Link from 'next/link';

export const metadata = {
  title: '用户协议 - 论文工坊',
  description: '论文工坊用户协议',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-theme-page text-theme-primary">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors">
            ← 返回首页
          </Link>
          <h1 className="text-xl font-bold mt-4">用户协议</h1>
          <p className="text-xs text-theme-dim mt-1">最后更新：2026 年 8 月</p>
        </div>

        <div className="prose prose-sm max-w-none text-theme-secondary">
          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-2">1. 服务说明</h2>
            <p className="text-xs leading-relaxed text-theme-muted">
              论文工坊（以下简称"本工具"）是一款基于人工智能技术的论文辅助修改工具，为用户提供语法检查、格式建议、逻辑梳理、降重润色等辅助服务。本工具仅作为写作辅助工具使用，不直接生成完整论文，也不提供代写、代发等学术不端相关服务。
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-2">2. 用户责任</h2>
            <ul className="list-disc pl-4 text-xs leading-relaxed text-theme-muted space-y-1">
              <li>用户应保证上传内容不侵犯他人知识产权或隐私权。</li>
              <li>用户应独立对最终提交的论文内容负责，本工具不对论文的学术合规性承担责任。</li>
              <li>用户不得利用本工具从事代写、买卖论文、伪造数据等违反学术诚信或法律法规的行为。</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-2">3. 账号与套餐</h2>
            <p className="text-xs leading-relaxed text-theme-muted">
              用户可通过手机号验证码注册账号。免费账号享有有限体验次数；付费套餐通过激活码开通，开通后权益绑定当前账号，不支持退款或转让。毕业季通行证等时效性套餐以激活时显示的到期时间为准。
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-2">4. 数据与隐私</h2>
            <p className="text-xs leading-relaxed text-theme-muted">
              用户上传的论文内容仅用于提供检测与修改服务，不会被公开或用于训练第三方模型。详见《隐私政策》。
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-2">5. 免责声明</h2>
            <p className="text-xs leading-relaxed text-theme-muted">
              本工具按"现状"提供服务，因网络、第三方 AI 服务、用户设备等原因导致的服务中断或结果偏差，本工具不承担赔偿责任，但将尽力恢复服务并协助用户解决问题。
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-2">6. 协议变更</h2>
            <p className="text-xs leading-relaxed text-theme-muted">
              本工具有权根据法律法规或服务变化更新本协议，更新后将在本页面公示，用户继续使用即视为同意更新后的协议。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
