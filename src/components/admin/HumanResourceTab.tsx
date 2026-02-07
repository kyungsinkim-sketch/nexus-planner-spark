import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Network, Users, DollarSign, BarChart3, Clock } from 'lucide-react';
import { OrganizationChart } from './OrganizationChart';
import { EmployeeList } from './EmployeeList';
import { SalaryTable } from './SalaryTable';
import { ProductivityTab } from './ProductivityTab';
import { DiligenceTab } from './DiligenceTab';
import { useTranslation } from '@/hooks/useTranslation';

export function HumanResourceTab() {
  const [activeTab, setActiveTab] = useState('org_chart');
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="org_chart" className="gap-2">
            <Network className="w-4 h-4" />
            {t('organizationChart')}
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-2">
            <Users className="w-4 h-4" />
            {t('employeeDirectory')}
          </TabsTrigger>
          <TabsTrigger value="salary" className="gap-2">
            <DollarSign className="w-4 h-4" />
            {t('salaryTable')}
          </TabsTrigger>
          <TabsTrigger value="productivity" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            {t('productivity')}
          </TabsTrigger>
          <TabsTrigger value="diligence" className="gap-2">
            <Clock className="w-4 h-4" />
            {t('diligence')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="org_chart" className="mt-4">
          <OrganizationChart />
        </TabsContent>

        <TabsContent value="employees" className="mt-4">
          <EmployeeList />
        </TabsContent>

        <TabsContent value="salary" className="mt-4">
          <SalaryTable />
        </TabsContent>

        <TabsContent value="productivity" className="mt-4">
          <ProductivityTab />
        </TabsContent>

        <TabsContent value="diligence" className="mt-4">
          <DiligenceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
