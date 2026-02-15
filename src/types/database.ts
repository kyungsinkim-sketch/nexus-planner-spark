// Database types generated from Supabase schema
export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    name: string
                    avatar: string | null
                    role: 'ADMIN' | 'MANAGER' | 'MEMBER'
                    department: string | null
                    work_status: 'AT_WORK' | 'NOT_AT_WORK' | 'LUNCH' | 'TRAINING' | 'REMOTE' | 'OVERSEAS' | 'FILMING' | 'FIELD'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    name: string
                    avatar?: string | null
                    role?: 'ADMIN' | 'MANAGER' | 'MEMBER'
                    department?: string | null
                    work_status?: 'AT_WORK' | 'NOT_AT_WORK' | 'LUNCH' | 'TRAINING' | 'REMOTE' | 'OVERSEAS' | 'FILMING' | 'FIELD'
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    avatar?: string | null
                    role?: 'ADMIN' | 'MANAGER' | 'MEMBER'
                    department?: string | null
                    work_status?: 'AT_WORK' | 'NOT_AT_WORK' | 'LUNCH' | 'TRAINING' | 'REMOTE' | 'OVERSEAS' | 'FILMING' | 'FIELD'
                    created_at?: string
                    updated_at?: string
                }
            }
            projects: {
                Row: {
                    id: string
                    title: string
                    client: string
                    status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
                    type: 'BIDDING' | 'EXECUTION' | null
                    priority: 'HIGH' | 'MEDIUM' | 'LOW' | null
                    start_date: string
                    end_date: string
                    description: string | null
                    progress: number | null
                    pm_id: string | null
                    team_member_ids: string[] | null
                    last_activity_at: string | null
                    health_schedule: 'ON_TRACK' | 'AT_RISK' | 'DELAYED' | null
                    health_workload: 'BALANCED' | 'OVERLOADED' | null
                    health_budget: 'HEALTHY' | 'TIGHT' | null
                    tasks_completed: number | null
                    tasks_total: number | null
                    budget: number | null
                    currency: 'KRW' | 'USD' | null
                    is_locked: boolean | null
                    feedback_status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | null
                    thumbnail: string | null
                    key_color: string | null
                    final_video_url: string | null
                    completed_at: string | null
                    completion_approved_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    title: string
                    client: string
                    status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
                    type?: 'BIDDING' | 'EXECUTION' | null
                    priority?: 'HIGH' | 'MEDIUM' | 'LOW' | null
                    start_date: string
                    end_date: string
                    description?: string | null
                    progress?: number | null
                    pm_id?: string | null
                    team_member_ids?: string[] | null
                    last_activity_at?: string | null
                    health_schedule?: 'ON_TRACK' | 'AT_RISK' | 'DELAYED' | null
                    health_workload?: 'BALANCED' | 'OVERLOADED' | null
                    health_budget?: 'HEALTHY' | 'TIGHT' | null
                    tasks_completed?: number | null
                    tasks_total?: number | null
                    budget?: number | null
                    currency?: 'KRW' | 'USD' | null
                    is_locked?: boolean | null
                    feedback_status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | null
                    thumbnail?: string | null
                    key_color?: string | null
                    final_video_url?: string | null
                    completed_at?: string | null
                    completion_approved_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    title?: string
                    client?: string
                    status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
                    type?: 'BIDDING' | 'EXECUTION' | null
                    priority?: 'HIGH' | 'MEDIUM' | 'LOW' | null
                    start_date?: string
                    end_date?: string
                    description?: string | null
                    progress?: number | null
                    pm_id?: string | null
                    team_member_ids?: string[] | null
                    last_activity_at?: string | null
                    health_schedule?: 'ON_TRACK' | 'AT_RISK' | 'DELAYED' | null
                    health_workload?: 'BALANCED' | 'OVERLOADED' | null
                    health_budget?: 'HEALTHY' | 'TIGHT' | null
                    tasks_completed?: number | null
                    tasks_total?: number | null
                    budget?: number | null
                    currency?: 'KRW' | 'USD' | null
                    is_locked?: boolean | null
                    feedback_status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | null
                    thumbnail?: string | null
                    key_color?: string | null
                    final_video_url?: string | null
                    completed_at?: string | null
                    completion_approved_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            project_milestones: {
                Row: {
                    id: string
                    project_id: string
                    title: string
                    completed: boolean
                    order_no: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    title: string
                    completed?: boolean
                    order_no: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    title?: string
                    completed?: boolean
                    order_no?: number
                    created_at?: string
                }
            }
            calendar_events: {
                Row: {
                    id: string
                    title: string
                    type: 'TASK' | 'DEADLINE' | 'MEETING' | 'PT' | 'DELIVERY' | 'TODO' | 'DELIVERABLE' | 'R_TRAINING'
                    start_at: string
                    end_at: string
                    project_id: string | null
                    owner_id: string
                    due_date: string | null
                    source: 'PAULUS' | 'GOOGLE'
                    google_event_id: string | null
                    todo_id: string | null
                    deliverable_id: string | null
                    attendee_ids: string[] | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    title: string
                    type: 'TASK' | 'DEADLINE' | 'MEETING' | 'PT' | 'DELIVERY' | 'TODO' | 'DELIVERABLE' | 'R_TRAINING'
                    start_at: string
                    end_at: string
                    project_id?: string | null
                    owner_id: string
                    due_date?: string | null
                    source?: 'PAULUS' | 'GOOGLE'
                    google_event_id?: string | null
                    todo_id?: string | null
                    deliverable_id?: string | null
                    attendee_ids?: string[] | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    title?: string
                    type?: 'TASK' | 'DEADLINE' | 'MEETING' | 'PT' | 'DELIVERY' | 'TODO' | 'DELIVERABLE' | 'R_TRAINING'
                    start_at?: string
                    end_at?: string
                    project_id?: string | null
                    owner_id?: string
                    due_date?: string | null
                    source?: 'PAULUS' | 'GOOGLE'
                    google_event_id?: string | null
                    todo_id?: string | null
                    deliverable_id?: string | null
                    attendee_ids?: string[] | null
                    created_at?: string
                    updated_at?: string
                }
            }
            chat_messages: {
                Row: {
                    id: string
                    project_id: string | null
                    user_id: string
                    content: string
                    attachment_id: string | null
                    direct_chat_user_id: string | null
                    room_id: string | null
                    message_type: 'text' | 'file' | 'location' | 'schedule' | 'decision'
                    location_data: Json | null
                    schedule_data: Json | null
                    decision_data: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    project_id?: string | null
                    user_id: string
                    content: string
                    attachment_id?: string | null
                    direct_chat_user_id?: string | null
                    room_id?: string | null
                    message_type?: 'text' | 'file' | 'location' | 'schedule' | 'decision'
                    location_data?: Json | null
                    schedule_data?: Json | null
                    decision_data?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string | null
                    user_id?: string
                    content?: string
                    attachment_id?: string | null
                    direct_chat_user_id?: string | null
                    room_id?: string | null
                    message_type?: 'text' | 'file' | 'location' | 'schedule' | 'decision'
                    location_data?: Json | null
                    schedule_data?: Json | null
                    decision_data?: Json | null
                    created_at?: string
                }
            }
            file_groups: {
                Row: {
                    id: string
                    project_id: string
                    category: 'DECK' | 'FINAL' | 'REFERENCE' | 'CONTRACT' | 'ETC'
                    title: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    category: 'DECK' | 'FINAL' | 'REFERENCE' | 'CONTRACT' | 'ETC'
                    title: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    category?: 'DECK' | 'FINAL' | 'REFERENCE' | 'CONTRACT' | 'ETC'
                    title?: string
                    created_at?: string
                }
            }
            file_items: {
                Row: {
                    id: string
                    file_group_id: string | null
                    name: string
                    uploaded_by: string
                    size: string | null
                    type: string | null
                    is_important: boolean | null
                    source: 'UPLOAD' | 'CHAT' | null
                    comment: string | null
                    storage_path: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    file_group_id?: string | null
                    name: string
                    uploaded_by: string
                    size?: string | null
                    type?: string | null
                    is_important?: boolean | null
                    source?: 'UPLOAD' | 'CHAT' | null
                    comment?: string | null
                    storage_path?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    file_group_id?: string
                    name?: string
                    uploaded_by?: string
                    size?: string | null
                    type?: string | null
                    is_important?: boolean | null
                    source?: 'UPLOAD' | 'CHAT' | null
                    comment?: string | null
                    storage_path?: string | null
                    created_at?: string
                }
            }
            personal_todos: {
                Row: {
                    id: string
                    title: string
                    assignee_ids: string[]
                    requested_by_id: string
                    project_id: string | null
                    due_date: string
                    priority: 'LOW' | 'NORMAL' | 'HIGH'
                    status: 'PENDING' | 'COMPLETED'
                    completed_at: string | null
                    source_task_id: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    title: string
                    assignee_ids: string[]
                    requested_by_id: string
                    project_id?: string | null
                    due_date: string
                    priority?: 'LOW' | 'NORMAL' | 'HIGH'
                    status?: 'PENDING' | 'COMPLETED'
                    completed_at?: string | null
                    source_task_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    title?: string
                    assignee_ids?: string[]
                    requested_by_id?: string
                    project_id?: string | null
                    due_date?: string
                    priority?: 'LOW' | 'NORMAL' | 'HIGH'
                    status?: 'PENDING' | 'COMPLETED'
                    completed_at?: string | null
                    source_task_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            performance_snapshots: {
                Row: {
                    id: string
                    user_id: string
                    period: string
                    total_score: number
                    financial_score: number
                    peer_score: number
                    rank: number
                    calculated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    period: string
                    total_score: number
                    financial_score: number
                    peer_score: number
                    rank: number
                    calculated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    period?: string
                    total_score?: number
                    financial_score?: number
                    peer_score?: number
                    rank?: number
                    calculated_at?: string
                }
            }
            portfolio_items: {
                Row: {
                    id: string
                    user_id: string
                    project_id: string
                    project_title: string
                    client: string
                    role: string
                    thumbnail: string | null
                    completed_at: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    project_id: string
                    project_title: string
                    client: string
                    role: string
                    thumbnail?: string | null
                    completed_at: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    project_id?: string
                    project_title?: string
                    client?: string
                    role?: string
                    thumbnail?: string | null
                    completed_at?: string
                    created_at?: string
                }
            }
            peer_feedback: {
                Row: {
                    id: string
                    project_id: string
                    from_user_id: string
                    to_user_id: string
                    rating: number
                    comment: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    from_user_id: string
                    to_user_id: string
                    rating: number
                    comment?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    from_user_id?: string
                    to_user_id?: string
                    rating?: number
                    comment?: string | null
                    created_at?: string
                }
            }
            project_contributions: {
                Row: {
                    id: string
                    project_id: string
                    user_id: string
                    contribution_rate: number
                    contribution_value: number
                    calculated_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    user_id: string
                    contribution_rate: number
                    contribution_value: number
                    calculated_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    user_id?: string
                    contribution_rate?: number
                    contribution_value?: number
                    calculated_at?: string
                }
            }
            training_sessions: {
                Row: {
                    id: string
                    user_id: string
                    date: string
                    time_slot: string
                    exercise_content: string | null
                    trainer_confirmed: boolean
                    trainee_confirmed: boolean
                    calendar_event_id: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    date: string
                    time_slot: string
                    exercise_content?: string | null
                    trainer_confirmed?: boolean
                    trainee_confirmed?: boolean
                    calendar_event_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    date?: string
                    time_slot?: string
                    exercise_content?: string | null
                    trainer_confirmed?: boolean
                    trainee_confirmed?: boolean
                    calendar_event_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            locker_assignments: {
                Row: {
                    locker_number: number
                    user_id: string
                    assigned_date: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    locker_number: number
                    user_id: string
                    assigned_date?: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    locker_number?: number
                    user_id?: string
                    assigned_date?: string
                    created_at?: string
                    updated_at?: string
                }
            }
            nexus_employees: {
                Row: {
                    id: string
                    employee_no: number
                    name: string
                    email: string | null
                    phone: string | null
                    status: string
                    join_date: string
                    department: string
                    team: string | null
                    position: string
                    category: string
                    level: string
                    class_level: string
                    annual_salary: number
                    monthly_salary: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    employee_no: number
                    name: string
                    email?: string | null
                    phone?: string | null
                    status?: string
                    join_date: string
                    department: string
                    team?: string | null
                    position: string
                    category: string
                    level: string
                    class_level: string
                    annual_salary: number
                    monthly_salary: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    employee_no?: number
                    name?: string
                    email?: string | null
                    phone?: string | null
                    status?: string
                    join_date?: string
                    department?: string
                    team?: string | null
                    position?: string
                    category?: string
                    level?: string
                    class_level?: string
                    annual_salary?: number
                    monthly_salary?: number
                    created_at?: string
                    updated_at?: string
                }
            }
            chat_rooms: {
                Row: {
                    id: string
                    project_id: string
                    name: string
                    description: string | null
                    is_default: boolean
                    created_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    name: string
                    description?: string | null
                    is_default?: boolean
                    created_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    name?: string
                    description?: string | null
                    is_default?: boolean
                    created_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            chat_room_members: {
                Row: {
                    room_id: string
                    user_id: string
                    joined_at: string
                }
                Insert: {
                    room_id: string
                    user_id: string
                    joined_at?: string
                }
                Update: {
                    room_id?: string
                    user_id?: string
                    joined_at?: string
                }
            }
            completion_reviews: {
                Row: {
                    id: string
                    project_id: string
                    from_user_id: string
                    to_user_id: string
                    rating: number
                    comment: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    from_user_id: string
                    to_user_id: string
                    rating: number
                    comment?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    from_user_id?: string
                    to_user_id?: string
                    rating?: number
                    comment?: string | null
                    created_at?: string
                }
            }
            project_financials: {
                Row: {
                    id: string
                    project_id: string
                    contract_amount: number
                    expenses: number
                    profit: number
                    profit_rate: number
                    vat_amount: number
                    net_revenue: number
                    payment_status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE'
                    payment_date: string | null
                    notes: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    contract_amount: number
                    expenses?: number
                    payment_status?: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE'
                    payment_date?: string | null
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    contract_amount?: number
                    expenses?: number
                    payment_status?: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE'
                    payment_date?: string | null
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            annual_financials: {
                Row: {
                    id: string
                    fiscal_year: number
                    total_revenue: number
                    total_expenses: number
                    overhead: number
                    payroll: number
                    production_cost: number
                    net_profit: number
                    profit_rate: number
                    quarterly_breakdown: Json | null
                    notes: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    fiscal_year: number
                    total_revenue: number
                    total_expenses: number
                    overhead?: number
                    payroll?: number
                    production_cost?: number
                    quarterly_breakdown?: Json | null
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    fiscal_year?: number
                    total_revenue?: number
                    total_expenses?: number
                    overhead?: number
                    payroll?: number
                    production_cost?: number
                    quarterly_breakdown?: Json | null
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            nexus_salary_grades: {
                Row: {
                    id: string
                    category: string
                    level: string
                    class_level: string
                    annual_salary: number
                    monthly_salary: number
                    hourly_wage: number | null
                    base_salary: number | null
                    fixed_overtime: number | null
                    meal_allowance: number | null
                    probation_salary: number | null
                    promotion_condition: string | null
                    tenure_requirement: string | null
                    experience_requirement: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    category: string
                    level: string
                    class_level: string
                    annual_salary: number
                    monthly_salary: number
                    hourly_wage?: number | null
                    base_salary?: number | null
                    fixed_overtime?: number | null
                    meal_allowance?: number | null
                    probation_salary?: number | null
                    promotion_condition?: string | null
                    tenure_requirement?: string | null
                    experience_requirement?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    category?: string
                    level?: string
                    class_level?: string
                    annual_salary?: number
                    monthly_salary?: number
                    hourly_wage?: number | null
                    base_salary?: number | null
                    fixed_overtime?: number | null
                    meal_allowance?: number | null
                    probation_salary?: number | null
                    promotion_condition?: string | null
                    tenure_requirement?: string | null
                    experience_requirement?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_user_monthly_training_count: {
                Args: {
                    p_user_id: string
                    p_year: number
                    p_month: number
                }
                Returns: number
            }
            get_user_total_training_count: {
                Args: {
                    p_user_id: string
                }
                Returns: number
            }
            get_available_lockers: {
                Args: Record<string, never>
                Returns: Array<{ locker_number: number }>
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
