-- Enable UUID extension
create extension if not exists "pgcrypto";

-- =========================================
-- TENANTS
-- =========================================
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  primary_color text,
  created_at timestamptz default now()
);

-- =========================================
-- PROFILES
-- =========================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  full_name text,
  role text check (role in ('super_admin', 'store_owner', 'customer')),
  created_at timestamptz default now()
);

-- =========================================
-- CATEGORIES
-- =========================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz default now()
);

-- =========================================
-- PRODUCTS
-- =========================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  price numeric(10,2) not null default 0,
  inventory integer default 0,
  image_url text,
  status text default 'active',
  created_at timestamptz default now()
);

-- =========================================
-- ORDERS
-- =========================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  total_amount numeric(10,2) not null,
  status text default 'pending',
  payment_status text default 'pending',
  created_at timestamptz default now()
);

-- =========================================
-- ORDER ITEMS
-- =========================================
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null,
  price numeric(10,2) not null
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  image_url text not null,
  created_at timestamptz default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  country text,
  city text,
  address_line text,
  phone text,
  created_at timestamptz default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  provider text,
  reference text,
  amount numeric(10,2),
  status text default 'pending',
  created_at timestamptz default now()
);