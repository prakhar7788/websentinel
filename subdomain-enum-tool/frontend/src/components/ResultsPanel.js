import React, { useState } from "react";
import styles from "./ResultsPanel.module.css";

export default function ResultsPanel({ subdomains, domain, done }) {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = filter.trim()
    ? subdomains.filter((s) => s.includes(filter.trim()))
    : subdomains;

  const handleCopy = async () => {
    if (!subdomains.length) return;
    await navigator.clipboard.writeText(subdomains.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!subdomains.length) return;
    const blob = new Blob([subdomains.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subdomains_${domain}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className={styles.panel} aria-label="Discovered subdomains">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Subdomains</h2>
          <span className={styles.count}>
            {subdomains.length} found{!done && subdomains.length > 0 && "…"}
          </span>
        </div>
        {subdomains.length > 0 && (
          <div className={styles.actions}>
            <button
              className={styles.iconBtn}
              onClick={handleCopy}
              title="Copy all to clipboard"
              aria-label="Copy all subdomains"
            >
              {copied ? "✓" : "⎘"}
            </button>
            <button
              className={styles.iconBtn}
              onClick={handleDownload}
              title="Download as .txt"
              aria-label="Download subdomains"
            >
              ↓
            </button>
          </div>
        )}
      </div>

      {subdomains.length > 4 && (
        <input
          className={styles.filterInput}
          type="text"
          placeholder="Filter subdomains…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter subdomains"
        />
      )}

      <ul className={styles.list} aria-label="Subdomain list">
        {filtered.length === 0 && (
          <li className={styles.empty}>
            {subdomains.length === 0
              ? "No subdomains found yet."
              : "No matches for your filter."}
          </li>
        )}
        {filtered.map((sub) => (
          <li key={sub} className={styles.item}>
            <span className={styles.bullet} aria-hidden="true">›</span>
            <a
              href={`https://${sub}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
              title={`Open ${sub}`}
            >
              {sub}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
