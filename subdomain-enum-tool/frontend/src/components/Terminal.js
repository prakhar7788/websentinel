import React, { useEffect, useRef } from "react";
import styles from "./Terminal.module.css";

// Color-codes map bash ANSI-like keywords to CSS classes
const KIND_CLASS = {
  output:  styles.lineOutput,
  info:    styles.lineInfo,
  stderr:  styles.lineStderr,
  error:   styles.lineError,
  success: styles.lineSuccess,
};

export default function Terminal({ lines, scanning }) {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className={styles.terminal} role="log" aria-label="Scan output" aria-live="polite">
      <div className={styles.titleBar}>
        <span className={styles.dot} style={{ background: "#f87171" }} />
        <span className={styles.dot} style={{ background: "#fbbf24" }} />
        <span className={styles.dot} style={{ background: "#4ade80" }} />
        <span className={styles.titleText}>terminal output</span>
        {scanning && <span className={styles.liveBadge} aria-label="Live output">● LIVE</span>}
      </div>

      <div className={styles.body}>
        {lines.length === 0 && !scanning && (
          <p className={styles.empty}>Waiting for scan output…</p>
        )}
        {lines.map((l) => (
          <div key={l.id} className={`${styles.line} ${KIND_CLASS[l.kind] || styles.lineOutput}`}>
            <span className={styles.lineText}>{l.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
