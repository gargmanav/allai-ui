# AllAI Property Management Platform

## Overview
AllAI Property is a comprehensive platform designed for part-time landlords and small property management companies. It aims to streamline property tracking, tenant management, maintenance monitoring, expense handling, and organization through automated reminders. The platform supports various user roles, including super admins, organization admins (landlords), property owners, contractors, and tenants, each with role-based access control. Key features include intuitive real estate portfolio management, ownership entity management, smart case tracking, and automated regulatory compliance, providing an efficient solution for managing rental properties.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, utilizing Vite for tooling.
- **Routing**: Wouter.
- **UI**: shadcn/ui components built on Radix UI, styled with Tailwind CSS (supporting light/dark modes).
- **State Management**: TanStack Query for server state.
- **Forms**: React Hook Form with Zod for validation.
- **UI/UX Decisions**: Focus on intuitive interfaces, multi-user dashboards tailored to each role, streamlined forms, and clear notifications. Prioritization of Property Owners on the landing page.

### Backend
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript (ES modules).
- **Database ORM**: Drizzle ORM.
- **Authentication**: Replit Auth (OpenID Connect) via Passport.js.
- **Session Management**: Express sessions with PostgreSQL store.
- **Background Jobs**: Node-cron for scheduled tasks.
- **API Design**: RESTful API.

### Database
- **Primary Database**: PostgreSQL via Neon serverless driver.
- **Schema Management**: Drizzle migrations.
- **Key Entities**: Users, Organizations, Properties, Tenants, Leases, Units, Smart Cases, Financial transactions, Automated reminders.

### Authentication & Authorization
- **Provider**: Replit Auth (OpenID Connect).
- **Session Storage**: PostgreSQL-backed.
- **Protection**: Middleware-based authentication and Role-Based Access Control (RBAC) for data scoping and isolation.
- **User Management**: Automatic user creation and organization assignment.
- **User Types**: Platform Super Admin, Org Admin, Contractor, Tenant, Property Owner.

### Development & Deployment
- **Build System**: Vite for frontend, esbuild for backend.
- **Type Safety**: Shared TypeScript types across frontend and backend.

### Feature Specifications
- Comprehensive property and tenant tracking.
- Maintenance issue management with smart case tracking.
- Financial transaction handling.
- Automated reminders.
- Contractor marketplace with specialty-based filtering.
- Email/SMS verification flows.
- Role-scoped data access for Maya AI.
- Quote and invoice system for contractors including comparison, counter-proposals, and acceptance workflows.
- Superadmin impersonation and detailed analytics dashboard.
- Full job lifecycle workflow for contractors, including scheduling, progress tracking, and completion.
- Vendor management in Portfolio section (Properties / Entities / Vendors toggle) with full CRUD, record payment, and W-9 tracking.
- 1099-NEC tax reporting with vendor payment tracking, bulk generation, CSV export, and W-9 status management.

## External Dependencies

### Core Frameworks
- **@neondatabase/serverless**: PostgreSQL driver.
- **drizzle-orm**: Type-safe ORM.
- **express**: Web application framework.
- **@tanstack/react-query**: Server state management.
- **react-hook-form**: Form state management.
- **zod**: Schema validation.

### UI & Styling
- **@radix-ui/***: Accessible UI primitives.
- **tailwindcss**: Utility-first CSS framework.
- **class-variance-authority**: Component variant utility.
- **lucide-react**: Icon library.

### Authentication & Session Management
- **passport**: Authentication middleware.
- **openid-client**: OpenID Connect client.
- **express-session**: Session middleware.
- **connect-pg-simple**: PostgreSQL session store.

### Integrations
- **Twilio**: SMS verification and emergency notifications.
- **SendGrid**: Email service.

### Utility Libraries
- **node-cron**: Cron job scheduler.
- **date-fns**: Date utility library.