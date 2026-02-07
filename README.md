# Nexus Planner - Project Management System

A modern, full-stack project management and collaboration platform built with React, TypeScript, and Supabase.

## 🚀 Features

### Core Functionality
- **Dashboard**: Real-time project overview with stats, weather, inspirational quotes, and personal to-do list
- **Calendar Management**: Full-featured calendar with event creation, editing, and Google Calendar integration
- **Project Management**: Comprehensive project tracking with progress indicators, milestones, and team collaboration
- **Chat System**: Real-time messaging for projects and direct messages between team members
- **File Management**: Organized file storage with categories (Deck, Final, Reference, Contract, etc.)
- **Personal To-Do**: Task management system with priorities and due dates
- **Performance Tracking**: Employee performance snapshots and peer feedback system
- **Portfolio Management**: Showcase completed projects and contributions

### Technical Features
- **Real-time Updates**: Supabase realtime subscriptions for instant data synchronization
- **Internationalization**: Multi-language support (Korean/English)
- **Responsive Design**: Mobile-first design that works on all devices
- **Role-Based Access**: Admin, Manager, and Member roles with appropriate permissions
- **Dark Mode**: Beautiful dark theme optimized for extended use
- **Type Safety**: Full TypeScript implementation for robust code

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **FullCalendar** - Calendar component
- **Zustand** - State management
- **React Router** - Client-side routing
- **Lucide React** - Icon library
- **Sonner** - Toast notifications

### Backend & Database
- **Supabase** - Backend as a Service
  - PostgreSQL database
  - Real-time subscriptions
  - Row Level Security (RLS)
  - Authentication
  - File storage

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Supabase account (for production)

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd nexus-planner-spark
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Configuration**

Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Google Calendar API (for calendar sync)
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

4. **Database Setup**

Run the migration file to set up your Supabase database:

```bash
# Navigate to Supabase SQL Editor and run:
supabase/migrations/001_initial_schema.sql
```

This will create:
- All necessary tables
- Indexes for performance
- Row Level Security policies
- Triggers for automatic timestamps
- Storage bucket for file uploads

5. **Start Development Server**
```bash
npm run dev
```

The application will be available at `http://localhost:8080`

## 🏗️ Project Structure

```
nexus-planner-spark/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── calendar/       # Calendar-specific components
│   │   ├── chat/           # Chat components
│   │   ├── layout/         # Layout components (Sidebar, etc.)
│   │   ├── project/        # Project-related components
│   │   └── ui/             # Base UI components (shadcn/ui)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions and configurations
│   │   ├── i18n.ts        # Internationalization
│   │   ├── supabase.ts    # Supabase client
│   │   └── utils.ts       # Helper functions
│   ├── mock/               # Mock data for development
│   ├── pages/              # Page components
│   │   ├── DashboardPage.tsx
│   │   ├── CalendarPage.tsx
│   │   ├── ProjectsPage.tsx
│   │   ├── ChatPage.tsx
│   │   └── ...
│   ├── services/           # API service layer
│   │   ├── authService.ts
│   │   ├── projectService.ts
│   │   ├── eventService.ts
│   │   ├── chatService.ts
│   │   ├── todoService.ts
│   │   └── fileService.ts
│   ├── stores/             # State management (Zustand)
│   │   └── appStore.ts
│   ├── types/              # TypeScript type definitions
│   │   ├── core.ts
│   │   └── database.ts
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── supabase/
│   └── migrations/         # Database migration files
├── public/                 # Static assets
└── package.json
```

## 🔑 Key Services

### Authentication Service (`authService.ts`)
- User sign up/sign in/sign out
- Profile management
- Work status updates

### Project Service (`projectService.ts`)
- CRUD operations for projects
- Project filtering and search
- Milestone management

### Event Service (`eventService.ts`)
- Calendar event management
- Date range queries
- Real-time event updates

### Chat Service (`chatService.ts`)
- Project-based messaging
- Direct messaging
- Real-time message delivery

### Todo Service (`todoService.ts`)
- Personal task management
- Priority and status tracking
- Assignment to multiple users

### File Service (`fileService.ts`)
- File upload to Supabase storage
- File categorization
- Metadata management

## 🎨 Customization

### Theme
The application uses CSS variables for theming. Modify `src/index.css` to customize colors:

```css
:root {
  --background: ...;
  --foreground: ...;
  --primary: ...;
  /* etc. */
}
```

### Translations
Add or modify translations in `src/lib/i18n.ts`:

```typescript
export const translations = {
  ko: { /* Korean translations */ },
  en: { /* English translations */ },
  // Add more languages here
};
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

The built files will be in the `dist/` directory.

### Deploy to Vercel
```bash
vercel deploy
```

### Deploy to Netlify
```bash
netlify deploy --prod
```

### Environment Variables
Make sure to set the following environment variables in your deployment platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 📊 Database Schema

### Main Tables
- `profiles` - User profiles and authentication
- `projects` - Project information and metadata
- `calendar_events` - Calendar events and deadlines
- `personal_todos` - Personal task management
- `chat_messages` - Chat and messaging
- `file_groups` - File organization
- `file_items` - Individual files
- `performance_snapshots` - Performance tracking
- `portfolio_items` - User portfolios
- `peer_feedback` - Peer reviews
- `project_contributions` - Contribution tracking

See `supabase/migrations/001_initial_schema.sql` for complete schema details.

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- User-based access control
- Secure file storage with access policies
- Environment variables for sensitive data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Backend powered by [Supabase](https://supabase.com/)
- Calendar by [FullCalendar](https://fullcalendar.io/)

## 📧 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

**Built with ❤️ by the Paulus.ai team**
