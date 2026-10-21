import React, { useState, useRef } from "react";
import styles from "./ScanForm.module.css";

export default function ScanForm({ onScan, scanning, apiBase }) {
  const [domain, setDomain] = useState("");
  const [mode, setMode] = useState("full");
  const [wordlistFile, setWordlistFile] = useState(null); // File object
  const [wordlistUploaded, setWordlistUploaded] = useState(null); // { filename, originalName, size }
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [domainError, setDomainError] = useState("");
  const fileInputRef = useRef(null);

  // ── Domain validation ──────────────────────
  const validateDomain = (val) => {
    const clean = val.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!clean) return { ok: false, msg: "Enter a domain" };
    if (!/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(clean)) {
      return { ok: false, msg: "Enter a valid domain (e.g. example.com)" };
    }
    return { ok: true, clean };
  };

  // ── Wordlist upload ────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith(".txt")) {
      setUploadError("Only .txt files are accepted");
      return;
    }

    setWordlistFile(file);
    setUploadError("");
    setUploading(true);
    setWordlistUploaded(null);

    const form = new FormData();
    form.append("wordlist", file);

    try {
      const res = await fetch(`${apiBase}/wordlist`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      setWordlistUploaded(data);
    } catch (err) {
      setUploadError(err.message);
      setWordlistFile(null);
    } finally {
      setUploading(false);
    }
  };

  const removeWordlist = () => {
    setWordlistFile(null);
    setWordlistUploaded(null);
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Submit ─────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    const rawDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const { ok, clean, msg } = validateDomain(rawDomain);
    if (!ok) {
      setDomainError(msg);
      return;
    }
    setDomainError("");
    onScan({
      domain: clean,
      wordlistFilename: wordlistUploaded?.filename || null,
      mode,
    });
  };

  const formatBytes = (b) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* Domain input */}
      <div className={styles.row}>
        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="domain">
            Target Domain
          </label>
          <div className={styles.inputWrap}>
            <span className={styles.inputIcon} aria-hidden="true">🌐</span>
            <input
              id="domain"
              className={`${styles.input} ${domainError ? styles.inputError : ""}`}
              type="text"
              placeholder="example.com"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                if (domainError) setDomainError("");
              }}
              disabled={scanning}
              autoComplete="off"
              spellCheck="false"
              aria-describedby={domainError ? "domain-error" : undefined}
            />
          </div>
          {domainError && (
            <p id="domain-error" className={styles.fieldError} role="alert">
              {domainError}
            </p>
          )}
        </div>

        {/* Mode selector */}
        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="mode">
            Scan Mode
          </label>
          <select
            id="mode"
            className={styles.select}
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            disabled={scanning}
          >
            <option value="full">Full Recon (infra_recon.sh)</option>
            <option value="domain">Domain Finder (domain.sh)</option>
          </select>
        </div>
      </div>

      {/* Wordlist upload */}
      <div className={styles.wordlistSection}>
        <span className={styles.label}>Wordlist (optional — for DNS brute force)</span>
        <div className={styles.wordlistRow}>
          <button
            type="button"
            className={styles.uploadBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning || uploading}
            aria-label="Upload wordlist file"
          >
            {uploading ? (
              <><span className={styles.spinner} aria-hidden="true" /> Uploading…</>
            ) : (
              <><span aria-hidden="true">📂</span> {wordlistUploaded ? "Replace Wordlist" : "Upload Wordlist"}</>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileChange}
            className={styles.hiddenInput}
            aria-hidden="true"
            tabIndex={-1}
          />

          {wordlistUploaded && (
            <div className={styles.wordlistChip}>
              <span className={styles.wordlistName} title={wordlistUploaded.originalName}>
                📄 {wordlistUploaded.originalName}
              </span>
              <span className={styles.wordlistSize}>
                {formatBytes(wordlistUploaded.size)}
              </span>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={removeWordlist}
                disabled={scanning}
                aria-label="Remove wordlist"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {uploadError && (
          <p className={styles.fieldError} role="alert">
            {uploadError}
          </p>
        )}

        {!wordlistUploaded && mode === "full" && (
          <p className={styles.hint}>
            Without a wordlist, gobuster and dnsx brute-force steps are skipped.
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        className={styles.scanBtn}
        disabled={scanning || uploading}
        aria-busy={scanning}
      >
        {scanning ? (
          <><span className={styles.spinner} aria-hidden="true" /> Scanning…</>
        ) : (
          <><span aria-hidden="true">🔍</span> Start Scan</>
        )}
      </button>
    </form>
  );
}
