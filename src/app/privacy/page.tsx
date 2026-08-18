import Link from 'next/link';

export const metadata = {
  title: '隐私政策 - 论文工坊',
  description: '论文工坊隐私政策',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-theme-page text-theme-primary">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors">
            ← 返回首页
          </Link>
          <h1 className="text-xl font-bold mt-4">隐私政策</h1>
          <p className="text-xs text-theme-dim mt-1">最后更新：2026 年 8 月</p>
        </div>

        <div className="prose prose-sm max-w-none text-theme-secondary">
          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-2">1. 我们收集的信息</h2>
            <ul className="list-disc pl-4 text-xs leading-relaxed text-theme-muted space-y-1">
              <li><strong>账号信息：</strong>手机号（用于登录和身份识别）。</li>
              <li><strong>论文内容：</strong>用户主动上传或输入的论文文本、章节、引用等内容。</li>
              <li><strong>使用数据：</strong>检测/修改次数、套餐状态、设备类型等用于服务优化的匿名统计数据。</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-2">2. 信息的使用方式</h2>
            <ul className="list-disc pl-4 text-xs leading-relaxed text-theme-muted space-y-1">
              <li>提供论文检测、修改、导出等核心服务。</li>
              <li>校验套餐额度与订单状态。</li>
              <li>改进产品体验与排查服务故障。</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-2">3. 信息的存储与保护</h2>
            <p className="text-xs leading-relaxed text-theme-muted">
              用户数据存储于 Supabase 云服务，采用行业标准的加密传输与访问控制。我们实施行级安全策略（RLS），确保用户只能访问自己的数据。
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-2">4. 信息共享</h2>
            <p className="text-xs leading-relaxed text-theme-muted">
              我们不会将用户的论文内容、个人信息出售或提供给任何第三方，除非法律法规要求或经用户明确同意。AI 模型服务仅接收必要的文本片段用于生成修改建议。
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-2">5. 用户权利</h2>
            <ul className="list-disc pl-4 text-xs leading-relaxed text-theme-muted space-y-1">
              <li>用户可随时删除自己的项目数据。</li>
              <li>用户可联系客服注销账号，注销后相关数据将在合理期限内删除。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-2">6. 政策更新</h2>
            <p className="text-xs leading-relaxed text-theme-muted">
              本政策可能随服务升级而更新，重大变更将在本页面显著位置提示。如有疑问，请通过应用内反馈渠道联系我们。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
