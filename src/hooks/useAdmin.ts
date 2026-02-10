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

export const useAdminEmployees = () => {
    const queryClient = useQueryClient();

    const { data: employees, isLoading, error } = useQuery({
        queryKey: ['adminEmployees'],
        queryFn: getEmployees
    });

    const addEmployeeMutation = useMutation({
        mutationFn: createEmployee,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminEmployees'] });
            toast.success('직원이 성공적으로 추가되었습니다.');
        },
        onError: (error: Error) => {
            toast.error(`직원 추가 실패: ${error.message}`);
        }
    });

    const updateEmployeeMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) => updateEmployee(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminEmployees'] });
            toast.success('직원 정보가 수정되었습니다.');
        },
        onError: (error: Error) => {
            toast.error(`수정 실패: ${error.message}`);
        }
    });

    const deleteEmployeeMutation = useMutation({
        mutationFn: deleteEmployee,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminEmployees'] });
            toast.success('직원이 삭제되었습니다.');
        },
        onError: (error: Error) => {
            toast.error(`삭제 실패: ${error.message}`);
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

    const { data: grades, isLoading, error } = useQuery({
        queryKey: ['adminSalaryGrades'],
        queryFn: getSalaryGrades
    });

    const updateGradeMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) => updateSalaryGrade(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminSalaryGrades'] });
            toast.success('연봉 정보가 수정되었습니다.');
        },
        onError: (error: Error) => {
            toast.error(`수정 실패: ${error.message}`);
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
