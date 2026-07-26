import type { CSSProperties } from "react";

type SystemLoadingProps = {
  className?: string;
  description?: string;
  fullScreen?: boolean;
  progress?: number;
  title?: string;
};

export function SystemLoading({
  className = "",
  description = "Vui lòng chờ trong giây lát.",
  fullScreen = false,
  progress,
  title = "Đang tải dữ liệu"
}: SystemLoadingProps) {
  const normalizedProgress = typeof progress === "number"
    ? Math.min(100, Math.max(0, Math.round(progress)))
    : null;

  return (
    <div
      className={`${fullScreen ? "moly-loading-screen" : "moly-loading-panel"} ${className}`}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div className="moly-loading-dots" aria-hidden="true" />
      <div className="moly-loading-glow moly-loading-glow-left" aria-hidden="true" />
      <div className="moly-loading-glow moly-loading-glow-right" aria-hidden="true" />

      <div className="moly-loading-content">
        <p className="moly-loading-brand">MOLY</p>

        <div
          className={`moly-loading-ring ${normalizedProgress === null ? "is-indeterminate" : ""}`}
          style={normalizedProgress === null
            ? undefined
            : ({ "--moly-loading-progress": `${normalizedProgress * 3.6}deg` } as CSSProperties)}
          aria-hidden="true"
        >
          <div className="moly-loading-ring-core">
            {normalizedProgress === null ? (
              <span className="moly-loading-pulse">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <strong>{normalizedProgress}%</strong>
            )}
          </div>
        </div>

        <div className="moly-loading-copy">
          {fullScreen ? <h1>{title}</h1> : <h2>{title}</h2>}
          <p>{description}</p>
        </div>

        <div className={`moly-loading-track ${normalizedProgress !== null ? "is-determinate" : ""}`} aria-hidden="true">
          <span style={normalizedProgress === null ? undefined : { width: `${normalizedProgress}%` }} />
        </div>

        <div className="moly-loading-steps" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

export function InlineSystemLoading({
  description,
  title = "Đang tải dữ liệu"
}: Pick<SystemLoadingProps, "description" | "title">) {
  return (
    <SystemLoading
      className="min-h-[280px]"
      description={description}
      title={title}
    />
  );
}
