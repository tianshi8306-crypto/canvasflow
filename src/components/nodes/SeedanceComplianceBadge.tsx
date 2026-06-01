import type { SeedanceImageComplianceResult } from "@/lib/seedance/seedanceImageCompliance";
import { seedanceComplianceSummary } from "@/lib/seedance/seedanceImageCompliance";

type Props = {
  compliance: SeedanceImageComplianceResult | undefined;
  /** pill 内紧凑角标；thumb 为参考条右下角 */
  variant?: "pill" | "thumb";
};

function IconCheck() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconWarn() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

/** Seedance 2.0 上游图合规标（LibTV 蓝勾语义：非「已 @」） */
export function SeedanceComplianceBadge({ compliance, variant = "thumb" }: Props) {
  if (!compliance || compliance.status === "pending") return null;

  const title = seedanceComplianceSummary(compliance);
  const detail = [...compliance.errors, ...compliance.warnings].join("\n");

  if (compliance.pass) {
    return (
      <span
        className={`seedanceComplianceBadge seedanceComplianceBadge--pass seedanceComplianceBadge--${variant}`}
        title={detail || title}
        aria-label={title}
      >
        <IconCheck />
      </span>
    );
  }

  if (compliance.status === "unknown") {
    return (
      <span
        className={`seedanceComplianceBadge seedanceComplianceBadge--unknown seedanceComplianceBadge--${variant}`}
        title={detail || title}
        aria-label={title}
      >
        ?
      </span>
    );
  }

  return (
    <span
      className={`seedanceComplianceBadge seedanceComplianceBadge--fail seedanceComplianceBadge--${variant}`}
      title={detail || title}
      aria-label={title}
      role="img"
    >
      <IconWarn />
    </span>
  );
}
