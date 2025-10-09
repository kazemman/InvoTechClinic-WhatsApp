# InvoTech Health Care System

## Overview

This is a comprehensive health care management application built for InvoTech Solutions. The system provides a complete solution for managing health care operations including patient registration, appointment scheduling, check-ins, queue management, consultations, and business insights. The application supports role-based access control with three user roles: staff, admin, and doctor, each with specific permissions and functionality.

The system is designed to streamline clinic workflow from patient registration through consultation completion, with real-time queue management and comprehensive reporting capabilities. It includes features for patient photo management, medical aid tracking, appointment conflict prevention, and revenue analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript for type safety and modern development
- **UI Library**: Shadcn/UI components built on Radix UI primitives for accessible, customizable components
- **Styling**: Tailwind CSS with CSS custom properties for consistent theming and responsive design
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js for RESTful API endpoints
- **Language**: TypeScript for full-stack type safety
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **File Uploads**: Multer middleware for patient photo management with file type validation
- **Real-time Communication**: WebSocket server for live queue updates and notifications
- **API Design**: RESTful endpoints with proper HTTP status codes and error handling

### Database Architecture
- **Database**: PostgreSQL via Neon serverless for scalable cloud database
- **ORM**: Drizzle ORM for type-safe database queries and migrations
- **Schema Design**: Normalized relational schema with proper foreign key relationships
- **Key Tables**:
  - Users (role-based access control)
  - Patients (comprehensive patient profiles)
  - Appointments (scheduling with conflict prevention)
  - Doctor Unavailability (doctor schedule blocking for specific time slots or full days)
  - Check-ins (patient arrival tracking)
  - Queue (real-time patient flow management)
  - Consultations (doctor notes and medical records)
  - Payments (revenue tracking with payment methods)
  - Activity Logs (audit trail for system actions)

### Authentication & Authorization
- **Role-Based Access Control**: Three distinct roles with granular permissions
  - Staff: Patient registration, appointments, check-ins, queue management
  - Admin: Full system access including all staff permissions, user management, business insights, system administration, and complete access to medical information and consultations
  - Doctor: Queue management, patient consultations, medical records access
- **Security**: JWT tokens with configurable expiration, password hashing with bcrypt
- **Route Protection**: Frontend and backend route guards based on user roles
- **n8n Integration**: API key authentication for external workflow automation
  - API keys stored securely with bcrypt hashing
  - Dual header support: `x-api-key` or `Authorization: Bearer sk_...`
  - Endpoints: 
    - `/api/patients/contacts` (GET) - Get all patient contact info
    - `/api/n8n/appointments` (POST) - Book new appointment by phone
    - `/api/n8n/appointments/upcoming` (GET) - Get patient's upcoming appointments by phone
    - `/api/n8n/appointments/reschedule` (PATCH) - Reschedule appointment by phone
    - `/api/n8n/appointments/cancel` (POST) - Cancel appointment by phone

### Real-time Features
- **WebSocket Integration**: Live queue updates across all connected clients
- **Auto-refresh**: Automatic data synchronization for critical operations
- **Live Notifications**: Real-time status updates for appointments and queue changes

### Mobile Responsiveness
- **Touch-Friendly Interface**: Optimized for tablets and mobile devices
- **Responsive Design**: Adaptive layout that works across all screen sizes
- **Collapsible Navigation**: Space-efficient sidebar that can be toggled on mobile
- **Mobile-First Approach**: Components designed with mobile usability in mind

### File Management
- **Patient Photos**: Secure upload and storage with file type validation
- **File Processing**: Image optimization and secure file serving
- **Storage Security**: Controlled access to uploaded patient images

## External Dependencies

### Database & Infrastructure
- **Neon Database**: Serverless PostgreSQL database with connection pooling
- **Drizzle Kit**: Database migrations and schema management
- **WebSocket Support**: Real-time communication via native WebSocket API

### Authentication & Security
- **JWT (jsonwebtoken)**: Token-based authentication system
- **bcrypt**: Secure password hashing and verification
- **Multer**: File upload middleware for patient photos

### Email Services
- **SendGrid**: Email service integration for user account creation notifications
- **Email Templates**: Automated emails for user onboarding and account setup

### UI & Styling
- **Radix UI**: Comprehensive set of accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Lucide React**: Consistent icon library for interface elements
- **Class Variance Authority**: Type-safe component variants

### Development Tools
- **TypeScript**: Full-stack type safety and developer experience
- **Vite**: Fast build tool with hot module replacement
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Tailwind integration

### Runtime Dependencies
- **React Query**: Server state management and caching
- **React Hook Form**: Form state management and validation
- **Zod**: Runtime type validation and schema definition
- **Wouter**: Lightweight routing solution

The application follows modern development practices with comprehensive type safety, proper error handling, and scalable architecture patterns suitable for a production clinic management system.