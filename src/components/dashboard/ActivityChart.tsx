import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CalendarEvent } from '@/types/core';

interface ActivityChartProps {
    events: CalendarEvent[];
}

export function ActivityChart({ events }: ActivityChartProps) {
    // Get last 7 days
    const getLast7Days = () => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            days.push(date.toISOString().split('T')[0]);
        }
        return days;
    };

    const last7Days = getLast7Days();
    
    const data = last7Days.map(date => {
        const dayEvents = events.filter(e => e.startAt.startsWith(date));
        return {
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            events: dayEvents.length,
            meetings: dayEvents.filter(e => e.type === 'MEETING').length,
            tasks: dayEvents.filter(e => e.type === 'TASK').length,
        };
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">Weekly Activity</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                            dataKey="date" 
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
                        />
                        <Legend 
                            wrapperStyle={{ fontSize: '12px' }}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="events" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))' }}
                            name="Total Events"
                        />
                        <Line 
                            type="monotone" 
                            dataKey="meetings" 
                            stroke="#10B981" 
                            strokeWidth={2}
                            dot={{ fill: '#10B981' }}
                            name="Meetings"
                        />
                        <Line 
                            type="monotone" 
                            dataKey="tasks" 
                            stroke="#F59E0B" 
                            strokeWidth={2}
                            dot={{ fill: '#F59E0B' }}
                            name="Tasks"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
