# Development Guide

This guide provides detailed information for developers working on the Nexus Planner project.

## 🏗️ Architecture Overview

### Frontend Architecture

The application follows a modern React architecture with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│           Pages (Views)                  │
│  - DashboardPage, CalendarPage, etc.    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Components Layer                 │
│  - Reusable UI components               │
│  - Feature-specific components          │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│       State Management (Zustand)        │
│  - Global app state                     │
│  - Persistent storage                   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Services Layer                   │
│  - API calls to Supabase                │
│  - Data transformation                  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Supabase (Backend)                 │
│  - PostgreSQL Database                  │
│  - Real-time subscriptions              │
│  - File storage                         │
└─────────────────────────────────────────┘
```

## 📁 Code Organization

### Services Pattern

All backend interactions go through service files in `src/services/`. This provides:
- **Abstraction**: Pages don't need to know about Supabase details
- **Reusability**: Services can be used across multiple components
- **Type Safety**: Services handle type transformations
- **Testability**: Easy to mock for testing

Example service structure:

```typescript
// src/services/exampleService.ts
import { supabase } from '@/lib/supabase';
import type { ExampleType } from '@/types/core';

export const getExamples = async (): Promise<ExampleType[]> => {
  const { data, error } = await supabase
    .from('examples')
    .select('*');
  
  if (error) throw error;
  return data.map(transformExample);
};

export const createExample = async (example: Partial<ExampleType>): Promise<ExampleType> => {
  // Implementation
};
```

### State Management

We use Zustand for global state management. The main store is in `src/stores/appStore.ts`.

**Key principles:**
- Keep state minimal and derived data in getters
- Use async actions for API calls
- Persist only necessary data (language, UI preferences)
- Provide both mock and real data modes

Example state pattern:

```typescript
interface AppState {
  // Data
  items: Item[];
  
  // Actions
  loadItems: () => Promise<void>;
  addItem: (item: Partial<Item>) => Promise<void>;
  
  // Getters
  getItemById: (id: string) => Item | undefined;
}
```

### Component Structure

Components should follow this structure:

```tsx
// 1. Imports
import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Button } from '@/components/ui/button';

// 2. Types/Interfaces
interface ComponentProps {
  title: string;
  onAction?: () => void;
}

// 3. Component
export function Component({ title, onAction }: ComponentProps) {
  // 3a. Hooks
  const { data } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  
  // 3b. Handlers
  const handleClick = () => {
    // Logic
  };
  
  // 3c. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

## 🎨 Styling Guidelines

### Tailwind CSS

We use Tailwind CSS with custom design tokens defined in `src/index.css`.

**Best practices:**
- Use semantic color variables (`bg-background`, `text-foreground`)
- Prefer utility classes over custom CSS
- Use `cn()` utility for conditional classes
- Keep responsive design in mind (`md:`, `lg:` prefixes)

Example:

```tsx
<div className={cn(
  "p-4 rounded-lg border",
  isActive && "bg-primary text-primary-foreground",
  "hover:shadow-lg transition-shadow"
)}>
  Content
</div>
```

### Component Variants

For components with multiple variants, use the `cva` (class-variance-authority) pattern:

```typescript
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border border-input",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

## 🔄 Data Flow

### Loading Data

1. **Initial Load**: Call `load*` actions in `useEffect`
2. **Real-time Updates**: Subscribe to Supabase channels
3. **User Actions**: Call service methods through store actions

Example:

```tsx
function MyComponent() {
  const { items, loadItems } = useAppStore();
  
  useEffect(() => {
    loadItems();
  }, [loadItems]);
  
  return <div>{/* Render items */}</div>;
}
```

### Creating/Updating Data

Always go through store actions:

```tsx
const { addItem } = useAppStore();

const handleSubmit = async (data) => {
  try {
    await addItem(data);
    toast.success('Item created!');
  } catch (error) {
    toast.error('Failed to create item');
  }
};
```

## 🔐 Authentication Flow

1. User signs in via `authService.signIn()`
2. Supabase creates session
3. `appStore.initializeAuth()` loads user profile
4. Protected routes check `isAuthenticated`
5. User data available in `currentUser`

## 🌐 Internationalization

Add translations in `src/lib/i18n.ts`:

```typescript
export const translations = {
  ko: {
    myKey: '한국어 텍스트',
  },
  en: {
    myKey: 'English text',
  },
};
```

Use in components:

```tsx
const { t } = useTranslation();
return <h1>{t('myKey')}</h1>;
```

## 🧪 Testing Strategy

### Unit Tests
- Test utility functions
- Test data transformations
- Test business logic

### Integration Tests
- Test service layer with mock Supabase
- Test component interactions
- Test state management

### E2E Tests
- Test critical user flows
- Test authentication
- Test data persistence

## 🚀 Performance Optimization

### Code Splitting
- Use React.lazy() for route-based splitting
- Load heavy components on demand

### Memoization
- Use `useMemo` for expensive calculations
- Use `useCallback` for event handlers passed to children
- Use `React.memo` for pure components

### Database Queries
- Use indexes for frequently queried fields
- Limit results with pagination
- Use select() to fetch only needed columns

## 🐛 Debugging

### Development Tools
- React DevTools for component inspection
- Zustand DevTools for state debugging
- Supabase Dashboard for database queries

### Common Issues

**Issue**: Data not updating in real-time
- Check Supabase realtime subscriptions
- Verify RLS policies allow SELECT
- Check network tab for subscription errors

**Issue**: TypeScript errors in services
- Regenerate database types from Supabase
- Add type assertions where needed
- Check for null/undefined handling

## 📝 Code Style

### TypeScript
- Use explicit types for function parameters
- Avoid `any` type
- Use interfaces for object shapes
- Use type aliases for unions

### Naming Conventions
- Components: PascalCase (`MyComponent`)
- Functions: camelCase (`handleClick`)
- Constants: UPPER_SNAKE_CASE (`MAX_ITEMS`)
- Files: kebab-case or PascalCase matching export

### Comments
- Use JSDoc for public APIs
- Explain "why" not "what"
- Keep comments up to date

## 🔄 Git Workflow

1. Create feature branch from `main`
2. Make changes with descriptive commits
3. Test locally
4. Push and create PR
5. Code review
6. Merge to `main`

### Commit Messages
Follow conventional commits:
- `feat: Add new feature`
- `fix: Fix bug`
- `docs: Update documentation`
- `style: Format code`
- `refactor: Refactor code`
- `test: Add tests`
- `chore: Update dependencies`

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

## 🤝 Getting Help

- Check existing issues on GitHub
- Review this documentation
- Ask in team chat
- Pair programming sessions

---

Happy coding! 🎉
