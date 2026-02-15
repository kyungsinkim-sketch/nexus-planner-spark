import { supabase } from '@/lib/supabase';
import {
    mockProjects,
    mockEvents,
    mockPersonalTodos,
    projectFinancials,
} from '@/mock/data';
import { getAllUsers } from './authService';

// Helper to map mock user IDs to real Supabase user IDs
const getUserIdMap = async (): Promise<Record<string, string>> => {
    try {
        const users = await getAllUsers();
        console.log('Fetched users for seeding:', users);

        const map: Record<string, string> = {};

        if (users.length === 0) return {};

        // Map u1, u2... to real users by name
        const nameMap: Record<string, string> = {
            'u1': '김경신',
            'u2': '장요한',
            'u3': '박민규',
            'u4': '백송희',
            'u5': '홍원준',
        };

        const mockIds = ['u1', 'u2', 'u3', 'u4', 'u5'];

        mockIds.forEach((mockId, index) => {
            // Try to find by name first
            const targetName = nameMap[mockId];
            if (targetName) {
                const found = users.find(u => u.name === targetName);
                if (found) {
                    map[mockId] = found.id;
                    return;
                }
            }

            // Fallback: admin for u1
            if (mockId === 'u1') {
                const admin = users.find(u => u.role === 'ADMIN');
                if (admin) {
                    map[mockId] = admin.id;
                    return;
                }
            }

            // Fallback: cyclic mapping
            const targetUser = users[index % users.length];
            map[mockId] = targetUser.id;
        });

        return map;
    } catch (e) {
        console.error('Error fetching users for seeding:', e);
        return {};
    }
};

// Get all real user IDs for team membership
const getAllUserIds = async (): Promise<string[]> => {
    try {
        const users = await getAllUsers();
        return users.map(u => u.id);
    } catch {
        return [];
    }
};

// Map IDs in an object using the user map
const mapObjectIds = (obj: any, userMap: Record<string, string>) => {
    const newObj = { ...obj };

    const safeId = (id?: string) => {
        if (!id) return null;
        if (userMap[id]) return userMap[id];
        if (id.length < 10) return null;
        return id;
    };

    if (newObj.pmId) newObj.pmId = safeId(newObj.pmId);
    if (newObj.ownerId) newObj.ownerId = safeId(newObj.ownerId);
    if (newObj.userId) newObj.userId = safeId(newObj.userId);
    if (newObj.requestedById) newObj.requestedById = safeId(newObj.requestedById);
    if (newObj.uploadedBy) newObj.uploadedBy = safeId(newObj.uploadedBy);
    if (newObj.fromUser && newObj.fromUser.id) newObj.fromUser.id = safeId(newObj.fromUser.id);

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

        const allUserIds = await getAllUserIds();
        console.log('All user IDs for team membership:', allUserIds);

        const results = {
            projects: 0,
            financials: 0,
            events: 0,
            todos: 0,
            skipped: 0,
            errors: [] as string[]
        };

        // Check existing projects to avoid duplicates
        const { data: existingProjects } = await supabase
            .from('projects')
            .select('title');
        const existingTitles = new Set((existingProjects || []).map((p: any) => p.title));

        // 1. Seed Projects
        console.log('Seeding projects...');
        const projectMap: Record<string, string> = {};

        for (const mockProject of mockProjects) {
            // Skip if project with same title already exists
            if (existingTitles.has(mockProject.title)) {
                console.log(`Skipping existing project: ${mockProject.title}`);
                results.skipped++;
                continue;
            }

            const mappedProject = mapObjectIds(mockProject, userMap);
            const { id: mockId, ...projectData } = mappedProject;

            // Ensure all users are team members
            let teamMemberIds = projectData.teamMemberIds || [];
            for (const uid of allUserIds) {
                if (!teamMemberIds.includes(uid)) {
                    teamMemberIds.push(uid);
                }
            }
            // Ensure PM is included
            if (projectData.pmId && !teamMemberIds.includes(projectData.pmId)) {
                teamMemberIds = [projectData.pmId, ...teamMemberIds];
            }

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
                    team_member_ids: teamMemberIds.length > 0 ? teamMemberIds : null,
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

        // 2. Seed Project Financials
        console.log('Seeding project financials...');
        for (const fin of projectFinancials) {
            const realProjectId = projectMap[fin.projectId];
            if (!realProjectId) {
                console.log(`Skipping financial for unmapped project: ${fin.projectId}`);
                continue;
            }

            const { error } = await supabase
                .from('project_financials')
                .insert({
                    project_id: realProjectId,
                    contract_amount: fin.contractAmount,
                    expenses: fin.actualExpense,
                    payment_status: 'PAID',
                    notes: null,
                });

            if (error) {
                console.warn(`Failed to insert financial for ${fin.projectId}:`, error);
                results.errors.push(`Financial ${fin.projectId}: ${error.message}`);
            } else {
                results.financials++;
            }
        }

        // 3. Seed Events
        console.log('Seeding events...');
        for (const mockEvent of mockEvents) {
            const mappedEvent = mapObjectIds(mockEvent, userMap);
            const realProjectId = mockEvent.projectId ? projectMap[mockEvent.projectId] : null;

            const { error } = await supabase
                .from('calendar_events')
                .insert({
                    title: mappedEvent.title,
                    type: mappedEvent.type,
                    start_at: mappedEvent.startAt,
                    end_at: mappedEvent.endAt,
                    owner_id: mappedEvent.ownerId || Object.values(userMap)[0],
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

        // 4. Seed Todos
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
            message: `Seeding completed: ${results.projects} projects (${results.skipped} skipped), ${results.financials} financials, ${results.events} events, ${results.todos} todos. Errors: ${results.errors.length}`,
            error: results.errors.length > 0 ? results.errors : undefined
        };
    } catch (error: any) {
        console.error('Seeding failed:', error);
        return { success: false, error: error.message };
    }
};
