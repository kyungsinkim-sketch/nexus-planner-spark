import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getSalaryGrades,
    updateSalaryGrade
} from '@/services/adminService';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

export const useAdminEmployees = () => {
    const queryClient = useQueryClient();
    const { t } = useTranslation();

    const { data: employees, isLoading, error } = useQuery({
        queryKey: ['adminEmployees'],
        queryFn: getEmployees
    });

    const addEmployeeMutation = useMutation({
        mutationFn: createEmployee,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminEmployees'] });
            toast.success(t('employeeAddedSuccess'));
        },
        onError: (error: Error) => {
            toast.error(`${t('employeeAddFailed')}: ${error.message}`);
        }
    });

    const updateEmployeeMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) => updateEmployee(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminEmployees'] });
            toast.success(t('employeeUpdatedSuccess'));
        },
        onError: (error: Error) => {
            toast.error(`${t('updateFailed')}: ${error.message}`);
        }
    });

    const deleteEmployeeMutation = useMutation({
        mutationFn: deleteEmployee,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminEmployees'] });
            toast.success(t('employeeDeletedSuccess'));
        },
        onError: (error: Error) => {
            toast.error(`${t('employeeDeleteFailed')}: ${error.message}`);
        }
    });

    return {
        employees,
        isLoading,
        error,
        addEmployee: addEmployeeMutation.mutate,
        updateEmployee: updateEmployeeMutation.mutate,
        deleteEmployee: deleteEmployeeMutation.mutate,
        isAdding: addEmployeeMutation.isPending,
        isUpdating: updateEmployeeMutation.isPending,
        isDeleting: deleteEmployeeMutation.isPending
    };
};

export const useAdminSalaryGrades = () => {
    const queryClient = useQueryClient();
    const { t } = useTranslation();

    const { data: grades, isLoading, error } = useQuery({
        queryKey: ['adminSalaryGrades'],
        queryFn: getSalaryGrades
    });

    const updateGradeMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) => updateSalaryGrade(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminSalaryGrades'] });
            toast.success(t('salaryUpdatedSuccess'));
        },
        onError: (error: Error) => {
            toast.error(`${t('updateFailed')}: ${error.message}`);
        }
    });

    return {
        grades,
        isLoading,
        error,
        updateGrade: updateGradeMutation.mutate,
        isUpdating: updateGradeMutation.isPending
    };
};
