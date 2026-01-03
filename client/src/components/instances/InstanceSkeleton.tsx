import { memo } from 'react';

/**
 * Skeleton loading component for card layout
 */
export const CardSkeleton = memo(function CardSkeleton() {
  return (
    <div className="bg-surface-700 rounded p-3 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pr-10">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-surface-500" />
          <div className="h-3 w-24 bg-surface-500 rounded" />
        </div>
        <div className="w-3 h-3 bg-surface-500 rounded" />
      </div>

      {/* Status badge */}
      <div className="h-4 w-16 bg-surface-500 rounded mb-2" />

      {/* Working directory */}
      <div className="h-2.5 w-full bg-surface-500 rounded" />

      {/* Terminal preview */}
      <div className="mt-2 bg-surface-900 rounded p-2 h-16">
        <div className="h-2 w-3/4 bg-surface-600 rounded mb-1.5" />
        <div className="h-2 w-1/2 bg-surface-600 rounded" />
      </div>
    </div>
  );
});

/**
 * Skeleton loading component for list layout
 */
export const ListSkeleton = memo(function ListSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 animate-pulse">
      {/* Drag handle */}
      <div className="w-3 h-4 bg-surface-500 rounded" />

      {/* Pin button */}
      <div className="w-4 h-4 bg-surface-500 rounded" />

      {/* Status dot */}
      <div className="w-2 h-2 rounded-full bg-surface-500" />

      {/* Name and path */}
      <div className="flex-1 min-w-0">
        <div className="h-3 w-32 bg-surface-500 rounded mb-1" />
        <div className="h-2.5 w-48 bg-surface-500 rounded" />
      </div>

      {/* Status badge */}
      <div className="h-4 w-14 bg-surface-500 rounded" />
    </div>
  );
});

interface InstanceSkeletonsProps {
  layout: 'cards' | 'list';
  count?: number;
}

/**
 * Renders multiple skeleton loaders based on layout type
 */
export function InstanceSkeletons({ layout, count = 3 }: InstanceSkeletonsProps) {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  if (layout === 'cards') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 p-3">
        {skeletons.map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-surface-600">
      {skeletons.map((i) => (
        <ListSkeleton key={i} />
      ))}
    </div>
  );
}
