# 论文工坊 Thesis Forge

AI 辅助论文修改工具：五维度检测、问题定位与修复、docx 导入导出。

## 当前能力

- 材料模板机制：目前支持毕业论文与个人陈述 PS
- 粘贴全文或导入 `.txt` / `.docx`
- 按标题结构自动拆分章节
- 正文中带引用的整句自动高亮，`[1]`、`[2-3]` 等格式可一键开关
- AI 改写前自动遮蔽引用标记，改写后原样恢复，避免误改引文编号
- 五维度检测：AI 痕迹、一致性、论证逻辑、格式规范、学术规范
- 整篇检测：全文综合评分、章节评分、跨章节一致性、引用与编号问题
- 单问题一键修复、按维度批量修复、自动修复闭环（修复前需要确认）
- 手机验证码登录（当前为本地模拟，验证码打印在浏览器控制台）
- 项目历史自动保存，未配置 Supabase 时回退到 localStorage
- 免费/基础/深度/通行证套餐与额度控制，当前为本地模拟开通
- 导出 `.txt` / `.docx`

## 本地开发

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 环境变量

复制 `.env.example` 为 `.env.local` 后填写：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/v1
NEXT_PUBLIC_API_MODEL=model-name
API_KEY=your-server-only-api-key
```

`NEXT_PUBLIC_*` 会进入浏览器端，`API_KEY` 只允许在服务端 API Route 中使用，不会下发到浏览器。

可选启用 Supabase 云同步：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## 检查

```bash
npm run lint
npm run build
```
