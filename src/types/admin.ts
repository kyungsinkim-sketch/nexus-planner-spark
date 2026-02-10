export interface AdminDepartment {
    id: string;
    name: string;
    color?: string;
    created_at?: string;
}

export interface AdminEmployee {
    id: string;
    employee_no: number;
    name: string;
    email?: string;
    phone?: string;
    status: '재직중' | '퇴사';
    join_date: string;

    department: string;
    team?: string;
    position: string;
    category: string;

    level: string;
    class_level: string;

    annual_salary: number;
    monthly_salary: number;

    created_at?: string;
    updated_at?: string;
}

export interface AdminSalaryGrade {
    id: string;
    category: string;
    level: string;
    class_level: string;

    annual_salary: number;
    monthly_salary: number;
    hourly_wage?: number;
    base_salary?: number;
    fixed_overtime?: number;
    meal_allowance?: number;
    probation_salary?: number;

    promotion_condition?: string;
    tenure_requirement?: string;
    experience_requirement?: string;

    created_at?: string;
    updated_at?: string;
}

export type CreateEmployeeInput = Omit<AdminEmployee, 'id' | 'created_at' | 'updated_at'>;
export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export type UpdateSalaryGradeInput = Partial<AdminSalaryGrade>;
