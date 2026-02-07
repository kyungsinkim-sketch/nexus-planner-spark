import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Project } from '@/types/core';

interface ProjectProgressChartProps {
    projects: Project[];
}

export function ProjectProgressChart({ projects }: ProjectProgressChartProps) {
    const activeProjects = projects.filter(p => p.status === 'ACTIVE');
    
    const data = activeProjects.map(project => ({
        name: project.title.length > 15 ? project.title.substring(0, 15) + '...' : project.title,
        progress: project.progress,
        keyColor: project.keyColor || '#3B82F6',
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">Project Progress</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 11 }}
                            className="text-muted-foreground"
                        />
                        <YAxis 
                            tick={{ fontSize: 11 }}
                            className="text-muted-foreground"
                        />
                        <Tooltip 
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                            }}
                            formatter={(value: number) => [`${value}%`, 'Progress']}
                        />
                        <Bar dataKey="progress" radius={[4, 4, 0, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.keyColor} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
