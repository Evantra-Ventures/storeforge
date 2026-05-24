# storeforge
Build, launch, and manage online stores faster


Next.js
TypeScript
Tailwind
shadcn/ui
Supabase
Resend
Paystack
PostHog

🚀 StoreForge


StoreForge is a multi-tenant SaaS eCommerce platform that allows users to create, manage, and deploy fully isolated online stores from a single scalable codebase.

Each store runs independently while sharing the same infrastructure, powered by Supabase and Row Level Security (RLS).

📌 Key Features
🏪 Multi-tenant store system
🔐 Secure authentication (Supabase Auth)
🧠 Automatic user profile creation
🏗 Tenant onboarding system
📦 Product & category management
🛒 Order system architecture
🔒 Row Level Security (RLS) isolation
🌐 Dynamic storefront routing (/store/[slug])
⚡ Scalable SaaS-ready backend
🧠 System Architecture
auth.users
    ↓
profiles (user identity + role + tenant link)
    ↓
tenants (store information)
    ↓
products / orders / categories
    ↓
storefront (slug-based routing)
🏗 Multi-Tenant Flow
User Signup
    ↓
Auto Profile Creation (customer role)
    ↓
Onboarding (Create Store)
    ↓
Tenant Created
    ↓
User upgraded to store_owner
    ↓
Full store access enabled
🔐 Security Model
Row Level Security enabled across all tables
Tenant-based data isolation
Users can only access their own store data
Secure RPC functions for sensitive operations
No cross-store data leakage possible
📂 Database Schema Overview
Core Tables
profiles
tenants
products
categories
orders
order_items
product_images
addresses
payments
⚙️ Tech Stack
Frontend: Next.js (App Router)
Backend: Supabase
Database: PostgreSQL
Auth: Supabase Auth
CLI: Supabase CLI
Deployment: Vercel (planned)
🚀 Setup Instructions
1. Clone Repository
git clone https://github.com/your-org/storeforge.git
cd storeforge
2. Install Dependencies
npm install
3. Setup Supabase

Install Supabase CLI:

supabase --version

Link project:

supabase link --project-ref YOUR_PROJECT_REF
4. Run Migrations
supabase db push
5. Environment Variables

Create .env.local:

NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

Optional server-only keys if using advanced Supabase features:

SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
6. Run Development Server
npm run dev

> The workspace now includes the Next.js App Router scaffold, a root layout, global styles, and a working `/store/[slug]` storefront route.

🏪 Storefront Routing

Each store is accessed via:

/store/[slug]

Example:

/store/tech-world
/store/fashion-hub

Each route dynamically loads:

- tenant info
- products
- storefront branding
🧠 Core Features Implemented
Authentication System
Auto profile creation on signup
Role-based system:
super_admin
store_owner
customer
Tenant System
Each store is a tenant
Created via secure RPC function
Linked to user profile
Onboarding Flow
Signup → Profile → Create Store → Store Owner Access
RLS Security
Every table protected
Tenant isolation enforced at database level
Secure function-based access control
🧭 Roadmap
Phase 1 (Completed)
 Database schema
 Auth system
 RLS policies
 Tenant onboarding
 Storefront routing
Phase 2 (In Progress)
 Admin dashboard
 Product CRUD UI
 Image upload system
 Order management
Phase 3
 Payments (Stripe / Paystack)
 Analytics dashboard
 Themes system
 Multi-store per user
🏗 Future Vision

StoreForge aims to become a plug-and-play SaaS engine where anyone can:

Launch an online store in minutes
Fully customize branding
Scale without backend complexity
Operate multiple stores under one account
🔒 Security Principles
All data is tenant-scoped
No shared cross-store access
Authentication enforced via Supabase
Server-side validation for all critical actions
📊 Status
MVP Foundation: COMPLETE
Backend: COMPLETE
Security Layer: COMPLETE
Frontend: IN PROGRESS
Project Setup: CONFIGURED
Production Readiness: 75%

The repository now includes:
- Next.js App Router scaffolding
- TypeScript and Node type support
- Supabase client connection for server-side storefront rendering
- A functioning `/store/[slug]` storefront page

🤝 Contributing

This project is currently under active development and maintained privately.

📄 License

Private — Evantra Commerce Internal Project
