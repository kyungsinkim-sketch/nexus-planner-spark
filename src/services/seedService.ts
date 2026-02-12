import { supabase } from '@/lib/supabase';
import {
    mockProjects,
    mockEvents,
    mockPersonalTodos
} from '@/mock/data';
import { getAllUsers } from './authService';

// Helper to map mock user IDs to real Supabase user IDs
const getUserIdMap = async (): Promise<Record<string, string>> => {
    try {
        const users = await getAllUsers();
        console.log('Fetched users for seeding:', users);

        const map: Record<string, string> = {};

        // If no users, we can't map. But we assume at least the current Admin exists.
        if (users.length === 0) return {};

        // Map u1, u2... to real users cyclically
        const mockIds = ['u1', 'u2', 'u3', 'u4', 'u5'];

        // Sort users to ensure deterministic mapping if possible, e.g. by created_at or email
        // Assuming getAllUsers returns sorted by name

        mockIds.forEach((mockId, index) => {
            // specific mapping for 'u1' (Admin) if possible
            if (mockId === 'u1') {
                const admin = users.find(u => u.role === 'ADMIN');
                if (admin) {
                    map[mockId] = admin.id;
                    return;
                }
            }

            // Fallback: map to user at index % length
            const targetUser = users[index % users.length];
            map[mockId] = targetUser.id;
        });

        return map;
    } catch (e) {
        console.error('Error fetching users for seeding:', e);
        return {};
    }
};

// Map IDs in an object using the user map
const mapObjectIds = (obj: any, userMap: Record<string, string>) => {
    const newObj = { ...obj };

    // Helper for safe ID (must be UUID-like or mapped)
    const safeId = (id?: string) => {
        if (!id) return null;
        if (userMap[id]) return userMap[id];
        if (id.length < 10) return null; // Assume mock IDs are short
        return id; // Assume already valid UUID
    };

    if (newObj.pmId) newObj.pmId = safeId(newObj.pmId);
    if (newObj.ownerId) newObj.ownerId = safeId(newObj.ownerId);
    if (newObj.userId) newObj.userId = safeId(newObj.userId);
    if (newObj.requestedById) newObj.requestedById = safeId(newObj.requestedById);
    if (newObj.uploadedBy) newObj.uploadedBy = safeId(newObj.uploadedBy);
    if (newObj.fromUser && newObj.fromUser.id) newObj.fromUser.id = safeId(newObj.fromUser.id);

    // Map arrays of IDs
    if (newObj.teamMemberIds) {
        newObj.teamMemberIds = newObj.teamMemberIds
            .map((id: string) => safeId(id))
            .filter((id: string | null) => id !== null);
    }
    if (newObj.assigneeIds) {
        newObj.assigneeIds = newObj.assigneeIds
            .map((id: string) => safeId(id))
            .filter((id: string | null) => id !== null);
    }

    return newObj;
};

export const seedDatabase = async () => {
    console.log('Starting database seed...');

    try {
        const userMap = await getUserIdMap();
        console.log('User mapping:', userMap);

        const results = {
            projects: 0,
            events: 0,
            todos: 0,
            errors: [] as string[]
        };

        // 1. Seed Projects
        console.log('Seeding projects...');
        const projectMap: Record<string, string> = {}; // Mock ID -> Real ID

        for (const mockProject of mockProjects) {
            const mappedProject = mapObjectIds(mockProject, userMap);

            // We must strip 'id' because Supabase generates UUIDs
            // BUT we need to track the mapping for child items (events, files)

            const { id: mockId, ...projectData } = mappedProject;

            const { data: insertedProject, error } = await supabase
                .from('projects')
                .insert({
                    title: projectData.title,
                    client: projectData.client,
                    status: projectData.status,
                    type: projectData.type || null,
                    priority: projectData.priority || null,
                    start_date: projectData.startDate,
                    end_date: projectData.endDate,
                    description: projectData.description || null,
                    progress: projectData.progress || 0,
                    pm_id: projectData.pmId || null,
                    team_member_ids: projectData.teamMemberIds || null,
                    health_schedule: projectData.health?.schedule || null,
                    health_workload: projectData.health?.workload || null,
                    health_budget: projectData.health?.budget || null,
                    tasks_completed: projectData.tasksCompleted || 0,
                    tasks_total: projectData.tasksTotal || 0,
                    budget: projectData.budget || null,
                    key_color: projectData.keyColor || null,
                })
                .select()
                .single();

            if (error) {
                console.warn(`Failed to insert project ${mockProject.title}:`, error);
                results.errors.push(`Project ${mockProject.title}: ${error.message}`);
            } else if (insertedProject) {
                projectMap[mockProject.id] = insertedProject.id;
                results.projects++;
            }
        }

        // 2. Seed Events
        console.log('Seeding events...');
        for (const mockEvent of mockEvents) {
            const mappedEvent = mapObjectIds(mockEvent, userMap);

            // Map Project ID
            const realProjectId = mockEvent.projectId ? projectMap[mockEvent.projectId] : null;

            const { error } = await supabase
                .from('calendar_events')
                .insert({
                    title: mappedEvent.title,
                    type: mappedEvent.type,
                    start_at: mappedEvent.startAt,
                    end_at: mappedEvent.endAt,
                    owner_id: mappedEvent.ownerId || Object.values(userMap)[0], // Fallback to first user
                    project_id: realProjectId,
                    source: mappedEvent.source || 'PAULUS',
                });

            if (error) {
                console.warn(`Failed to insert event ${mockEvent.title}:`, error);
                results.errors.push(`Event ${mockEvent.title}: ${error.message}`);
            } else {
                results.events++;
            }
        }

        // 3. Seed Todos
        console.log('Seeding todos...');
        for (const mockTodo of mockPersonalTodos) {
            const mappedTodo = mapObjectIds(mockTodo, userMap);
            const realProjectId = mockTodo.projectId ? projectMap[mockTodo.projectId] : null;

            const { error } = await supabase
                .from('personal_todos')
                .insert({
                    title: mappedTodo.title,
                    assignee_ids: mappedTodo.assigneeIds,
                    requested_by_id: mappedTodo.requestedById || Object.values(userMap)[0],
                    project_id: realProjectId,
                    due_date: mappedTodo.dueDate,
                    priority: mappedTodo.priority,
                    status: mappedTodo.status,
                    created_at: mappedTodo.createdAt
                });

            if (error) {
                console.warn(`Failed to insert todo ${mockTodo.title}:`, error);
                results.errors.push(`Todo ${mockTodo.title}: ${error.message}`);
            } else {
                results.todos++;
            }
        }

        return {
            success: results.errors.length === 0 || results.projects > 0,
            message: `Seeding completed: ${results.projects} projects, ${results.events} events, ${results.todos} todos. Errors: ${results.errors.length}`,
            error: results.errors.length > 0 ? results.errors : undefined
        };
    } catch (error: any) {
        console.error('Seeding failed:', error);
        return { success: false, error: error.message };
    }
};
