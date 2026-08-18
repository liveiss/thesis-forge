-- ============================================================
-- 论文工坊 Commercial Stage 2 数据库迁移
-- 表：profiles / projects / usage_logs / orders / subscriptions
-- 执行方式：Supabase Dashboard → SQL Editor → New query → 粘贴 → Run
-- ============================================================

-- 用户资料表（与 auth.users 一对一）
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  phone text unique,
  plan text not null default 'free' check (plan in ('free','basic','deep','season')),
  plan_expire timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '用户资料与当前套餐';

-- 项目表
 create table if not exists public.projects (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  type text not null default 'thesis',
  major text not null default '',
  citation_style text not null default 'gb',
  word_limit int not null default 8000,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is '论文项目存储';

-- 用量日志表（用于额度校验和统计）
create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  type text not null check (type in ('detect','fix','generate')),
  created_at timestamptz not null default now()
);

comment on table public.usage_logs is 'AI 功能用量日志';

-- 订单表
 create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plan text not null check (plan in ('basic','deep','season')),
  amount int not null, -- 单位：分
  currency text not null default 'CNY',
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  provider text not null default 'weixinpay',
  provider_order_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.orders is '支付订单';

-- 订阅表
 create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plan text not null check (plan in ('basic','deep','season')),
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is '用户订阅/套餐权益';

-- ============================================================
-- RLS（行级安全）：每个用户只能访问自己的数据
-- ============================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.usage_logs enable row level security;
alter table public.orders enable row level security;
alter table public.subscriptions enable row level security;

-- profiles：用户可读写自己的资料
 create policy "profiles_self_all"
  on public.profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- projects：用户可读写自己的项目
 create policy "projects_self_all"
  on public.projects
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- usage_logs：用户只能插入和查看自己的用量
 create policy "usage_logs_self_insert"
  on public.usage_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

 create policy "usage_logs_self_select"
  on public.usage_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

-- orders：用户可查看自己的订单
 create policy "orders_self_select"
  on public.orders
  for select
  to authenticated
  using (auth.uid() = user_id);

-- subscriptions：用户可查看自己的订阅
 create policy "subscriptions_self_select"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- 函数：用户注册后自动创建 profile
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, phone, plan)
  values (
    new.id,
    new.phone,
    'free'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- 触发器：auth.users 新增用户时自动创建 profile
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 索引：加速常用查询
-- ============================================================
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_usage_logs_user_created on public.usage_logs(user_id, created_at);
create index if not exists idx_orders_user_status on public.orders(user_id, status);
create index if not exists idx_subscriptions_user_active on public.subscriptions(user_id, status, expires_at);

-- ============================================================
-- 激活码表（兑换码）：适合个人开发者无商户资质时快速商用
-- ============================================================
create table if not exists public.redemption_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  plan text not null check (plan in ('basic','deep','season')),
  duration_days int, -- null 表示单篇/永久，season 建议 90 天
  used_by uuid references auth.users on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.redemption_codes is '套餐激活码/兑换码';

-- 激活码查询策略：已登录用户可查看自己被分配/使用过的码
 create policy "redemption_codes_self_used"
  on public.redemption_codes
  for select
  to authenticated
  using (used_by = auth.uid());
