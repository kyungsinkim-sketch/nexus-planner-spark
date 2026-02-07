import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import type { AdminEmployee, AdminSalaryGrade, CreateEmployeeInput, UpdateEmployeeInput, UpdateSalaryGradeInput } from '@/types/admin';
import { mockEmployees, mockSalaryGrades } from '@/mock/adminData';

// ============================================
// EMPLOYEES
// ============================================

export const getEmployees = async (): Promise<AdminEmployee[]> => {
    if (!isSupabaseConfigured()) {
        return mockEmployees;
    }

    const { data, error } = await supabase
        .from('nexus_employees')
        .select('*')
        .order('employee_no', { ascending: true });

    if (error) throw new Error(handleSupabaseError(error));
    return (data && data.length > 0) ? data : mockEmployees;
};

export const createEmployee = async (employee: CreateEmployeeInput): Promise<AdminEmployee> => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { data, error } = await supabase
        .from('nexus_employees')
        .insert([employee] as any)
        .select()
        .single();

    if (error) throw new Error(handleSupabaseError(error));
    return data;
};

export const updateEmployee = async (id: string, updates: UpdateEmployeeInput): Promise<AdminEmployee> => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { data, error } = await supabase
        .from('nexus_employees')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(handleSupabaseError(error));
    return data;
};

export const deleteEmployee = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { error } = await supabase
        .from('nexus_employees')
        .delete()
        .eq('id', id);

    if (error) throw new Error(handleSupabaseError(error));
};

// ============================================
// SALARY GRADES
// ============================================

export const getSalaryGrades = async (): Promise<AdminSalaryGrade[]> => {
    if (!isSupabaseConfigured()) {
        return mockSalaryGrades;
    }

    const { data, error } = await supabase
        .from('nexus_salary_grades')
        .select('*')
        .order('annual_salary', { ascending: false });

    if (error) throw new Error(handleSupabaseError(error));
    return (data && data.length > 0) ? data : mockSalaryGrades;
};

export const updateSalaryGrade = async (id: string, updates: UpdateSalaryGradeInput): Promise<AdminSalaryGrade> => {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

    const { data, error } = await supabase
        .from('nexus_salary_grades')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(handleSupabaseError(error));
    return data;
};
