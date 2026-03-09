/**
 * MeshLoader — Re-Be.io loading animation.
 * Displays the star logo with a smooth rotation.
 */

interface MeshLoaderProps {
  size?: number;
  message?: string;
}

export function MeshLoader({ size = 200, message }: MeshLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <img
        src="/loading-star.png"
        alt="Loading"
        style={{ width: size, height: size }}
        className="animate-[spin_12s_linear_infinite]"
      />
      {message && (
        <p className="text-[#C5C0E8]/70 text-sm animate-pulse">{message}</p>
      )}
    </div>
  );
}
