/**
 * BrainInsightsWidget — AI-generated insights for a project.
 */

import { Lightbulb } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function BrainInsightsWidget({ context }: { context: WidgetDataContext }) {
  if (!context.projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        No project selected
      </div>
    );
  }

  // TODO: Wire to Brain AI insights service
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
      <Lightbulb className="w-8 h-8 text-primary/50" />
      <div>
        <p className="text-sm font-medium text-foreground/80">Brain Insights</p>
        <p className="text-xs text-muted-foreground mt-1">
          AI-powered project analysis will appear here
        </p>
      </div>
    </div>
  );
}

export default BrainInsightsWidget;
