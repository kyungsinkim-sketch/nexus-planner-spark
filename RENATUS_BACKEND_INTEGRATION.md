# Renatus Welfare Backend Integration Guide

## 📋 Overview

This guide provides step-by-step instructions for integrating the Renatus welfare management backend with the existing Nexus Planner application.

## 🗄️ Database Schema

### Tables Created

#### 1. `training_sessions`
Stores gym training session bookings.

**Columns:**
- `id` (UUID, PK): Unique session identifier
- `user_id` (UUID, FK → profiles): User who booked the session
- `date` (DATE): Session date
- `time_slot` (TEXT): Time slot (e.g., '오전 9시', '오후 2시')
- `exercise_content` (TEXT, nullable): Description of exercises performed
- `trainer_confirmed` (BOOLEAN): Trainer confirmation status
- `trainee_confirmed` (BOOLEAN): Trainee confirmation status
- `calendar_event_id` (UUID, FK → calendar_events, nullable): Linked calendar event
- `created_at` (TIMESTAMPTZ): Creation timestamp
- `updated_at` (TIMESTAMPTZ): Last update timestamp

**Constraints:**
- UNIQUE(date, time_slot): Only one person per time slot
- CHECK: time_slot must be one of the predefined values

#### 2. `locker_assignments`
Stores locker assignments for gym members.

**Columns:**
- `locker_number` (INTEGER, PK): Locker number (1-25)
- `user_id` (UUID, FK → profiles): Assigned user
- `assigned_date` (DATE): Assignment date
- `created_at` (TIMESTAMPTZ): Creation timestamp
- `updated_at` (TIMESTAMPTZ): Last update timestamp

**Constraints:**
- CHECK: locker_number between 1 and 25
- UNIQUE(user_id): One locker per user

### Helper Functions

#### `get_user_monthly_training_count(p_user_id UUID, p_year INTEGER, p_month INTEGER)`
Returns the number of training sessions for a user in a specific month.

#### `get_user_total_training_count(p_user_id UUID)`
Returns the total number of training sessions for a user.

#### `get_available_lockers()`
Returns a list of available (unassigned) locker numbers.

## 🚀 Migration Steps

### Step 1: Run Database Migration

```bash
# Navigate to project root
cd /Users/pablo/Paulus.ai/Hamony/nexus-planner-spark

# Apply migration using Supabase CLI (if available)
supabase db push

# OR manually run the migration SQL in Supabase Dashboard:
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Copy contents of supabase/migrations/002_renatus_welfare.sql
# 3. Execute the SQL
```

### Step 2: Verify Migration

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('training_sessions', 'locker_assignments');

-- Check if functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%training%' OR routine_name LIKE '%locker%';
```

### Step 3: Test RLS Policies

```sql
-- Test as admin user
SELECT * FROM training_sessions;
SELECT * FROM locker_assignments;

-- Test creating a session
INSERT INTO training_sessions (user_id, date, time_slot)
VALUES ('your-user-id', '2026-02-05', '오전 10시');

-- Test creating a locker assignment (admin only)
INSERT INTO locker_assignments (locker_number, user_id)
VALUES (1, 'your-user-id');
```

## 📡 API Service Usage

### Training Sessions

```typescript
import {
    getTrainingSessions,
    getTrainingSessionsByDate,
    createTrainingSession,
    updateTrainingSession,
    deleteTrainingSession,
    getUserMonthlyStats,
} from '@/services/welfareService';

// Get all sessions
const sessions = await getTrainingSessions();

// Get sessions for a specific date
const todaySessions = await getTrainingSessionsByDate('2026-02-04');

// Create a new session
const newSession = await createTrainingSession({
    userId: 'user-uuid',
    date: '2026-02-05',
    timeSlot: '오전 10시',
    exerciseContent: 'Bench Press 3 sets',
});

// Update session
await updateTrainingSession(sessionId, {
    exerciseContent: 'Updated content',
    trainerConfirmed: true,
});

// Get user statistics
const stats = await getUserMonthlyStats('user-uuid', 2026, 2);
console.log(`Monthly: ${stats.monthlyCount}, Total: ${stats.totalCount}`);
```

### Locker Assignments

```typescript
import {
    getLockerAssignments,
    createLockerAssignment,
    deleteLockerAssignment,
    getAvailableLockers,
} from '@/services/welfareService';

// Get all assignments
const assignments = await getLockerAssignments();

// Assign a locker
await createLockerAssignment({
    lockerNumber: 5,
    userId: 'user-uuid',
});

// Remove assignment
await deleteLockerAssignment(5);

// Get available lockers
const available = await getAvailableLockers();
console.log('Available lockers:', available);
```

### Realtime Subscriptions

```typescript
import {
    subscribeToTrainingSessions,
    subscribeToLockerAssignments,
} from '@/services/welfareService';

// Subscribe to training session changes
const unsubscribe1 = subscribeToTrainingSessions((session) => {
    console.log('Session updated:', session);
    // Update UI accordingly
});

// Subscribe to locker assignment changes
const unsubscribe2 = subscribeToLockerAssignments((assignment) => {
    console.log('Locker assignment updated:', assignment);
    // Update UI accordingly
});

// Cleanup on component unmount
return () => {
    unsubscribe1();
    unsubscribe2();
};
```

## 🔄 Integration with WelfareTab Component

### Replace Mock Data with Real API Calls

1. **Import the service:**
```typescript
import {
    getTrainingSessions,
    getTrainingSessionsByDate,
    createTrainingSession,
    updateTrainingSession,
    deleteTrainingSession,
    getLockerAssignments,
    createLockerAssignment,
    deleteLockerAssignment,
    getUserMonthlyStats,
} from '@/services/welfareService';
```

2. **Load data on component mount:**
```typescript
useEffect(() => {
    const loadData = async () => {
        try {
            const [sessions, lockers] = await Promise.all([
                getTrainingSessions(),
                getLockerAssignments(),
            ]);
            setTrainingSessions(sessions);
            setLockerAssignments(lockers);
        } catch (error) {
            console.error('Failed to load welfare data:', error);
            toast.error('데이터 로드 실패');
        }
    };
    
    loadData();
}, []);
```

3. **Replace create/update/delete handlers:**
```typescript
const handleCreateBooking = async () => {
    try {
        const newSession = await createTrainingSession({
            userId: selectedUserId,
            date: selectedDate,
            timeSlot: selectedTimeSlot,
        });
        
        // Also create calendar event
        const calendarEvent = await addEvent({
            title: 'Renatus 트레이닝',
            type: 'R_TRAINING',
            startAt: /* ... */,
            endAt: /* ... */,
            ownerId: selectedUserId,
            source: 'PAULUS',
        });
        
        // Link calendar event to session
        await updateTrainingSession(newSession.id, {
            calendarEventId: calendarEvent.id,
        });
        
        toast.success('예약이 생성되었습니다');
    } catch (error) {
        toast.error('예약 생성 실패');
    }
};
```

## 🔐 Security Considerations

### Row Level Security (RLS)

All tables have RLS enabled with the following policies:

**Training Sessions:**
- ✅ All users can view all sessions
- ✅ Users can create their own sessions
- ✅ Admins can create any session
- ✅ Users can update/delete their own sessions
- ✅ Admins can update/delete any session

**Locker Assignments:**
- ✅ All users can view all assignments
- ✅ Only admins can create/update/delete assignments

### Best Practices

1. **Always validate user permissions** before allowing actions
2. **Use transactions** for operations that affect multiple tables
3. **Handle errors gracefully** and provide user feedback
4. **Implement optimistic updates** for better UX
5. **Use realtime subscriptions** to keep data in sync

## 📊 Performance Optimization

### Indexes Created

- `idx_training_sessions_user_id`: Fast user lookups
- `idx_training_sessions_date`: Fast date range queries
- `idx_training_sessions_date_time`: Fast slot availability checks
- `idx_locker_assignments_user_id`: Fast user locker lookups

### Query Optimization Tips

1. **Use date range queries** instead of fetching all sessions
2. **Leverage indexes** by filtering on indexed columns
3. **Use RPC functions** for complex aggregations
4. **Batch operations** when possible

## 🧪 Testing Checklist

- [ ] Migration applied successfully
- [ ] Tables created with correct schema
- [ ] RLS policies working as expected
- [ ] Helper functions returning correct results
- [ ] API service methods working
- [ ] Realtime subscriptions functioning
- [ ] Calendar integration working
- [ ] Error handling implemented
- [ ] UI updates reflecting database changes
- [ ] Performance is acceptable

## 🐛 Troubleshooting

### Common Issues

**Issue:** Type errors in welfareService.ts
**Solution:** Restart TypeScript server or rebuild the project

**Issue:** RLS policy denying access
**Solution:** Check user role and ensure proper authentication

**Issue:** Unique constraint violation
**Solution:** Check for existing bookings in the same time slot

**Issue:** Realtime not working
**Solution:** Verify Supabase realtime is enabled in project settings

## 📝 Next Steps

1. ✅ Database schema created
2. ✅ API service implemented
3. ✅ Type definitions updated
4. ⏳ Integrate with WelfareTab component
5. ⏳ Add error handling and loading states
6. ⏳ Implement realtime subscriptions
7. ⏳ Add comprehensive testing
8. ⏳ Deploy and monitor

## 🔗 Related Files

- **Migration:** `/supabase/migrations/002_renatus_welfare.sql`
- **Service:** `/src/services/welfareService.ts`
- **Types:** `/src/types/database.ts`
- **Component:** `/src/components/admin/WelfareTab.tsx`

---

**Created:** 2026-02-04  
**Last Updated:** 2026-02-04  
**Status:** Ready for Integration
