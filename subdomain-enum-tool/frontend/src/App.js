import React, { useState, useCallback } from "react";
import ScanForm from "./components/ScanForm";
import Terminal from "./components/Terminal";
import ResultsPanel from "./components/ResultsPanel";
import styles from "./App.module.css";

const API_BASE = process.env.REACT_APP_API_URL || "/api";

export default function App() {
  const [lines, setLines] = useState([]);
  const [subdomains, setSubdomains] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [currentDomain, setCurrentDomain] = useState("");

  const pushLine = useCallback((text, kind = "output") => {
    setLines((prev) => [...prev, { text, kind, id: Date.now() + Math.random() }]);
  }, []);

  const handleScan = useCallback(
    ({ domain, wordlistFilename, mode }) => {
      setLines([]);
      setSubdomains([]);
      setScanDone(false);
      setCurrentDomain(domain);
      setScanning(true);

      const params = new URLSearchParams({ domain, mode });
      if (wordlistFilename) params.set("wordlist", wordlistFilename);

      const es = new EventSource(`${API_BASE}/scan?${params}`);

      es.onmessage = (e) => {
        const msg = JSON.parse(e.data);

        if (msg.type === "output" || msg.type === "stderr" || msg.type === "info") {
          pushLine(msg.data, msg.type);

          // Pull out subdomain-looking lines for the results panel
          const domainPattern = new RegExp(
            `([a-zA-Z0-9._-]+\\.${escapeRe(domain)})`,
            "g"
          );
          const matches = msg.data.match(domainPattern);
          if (matches) {
            setSubdomains((prev) => {
              const next = [...new Set([...prev, ...matches])].sort();
              return next;
            });
          }
        }

        if (msg.type === "error") {
          pushLine(msg.data, "error");
        }

        if (msg.type === "done") {
          pushLine(
            `\n[Process exited with code ${msg.data.exitCode}]`,
            msg.data.exitCode === 0 ? "success" : "error"
          );
          setScanning(false);
          setScanDone(true);
          es.close();
        }
      };

      es.onerror = () => {
        pushLine("Connection to server lost.", "error");
        setScanning(false);
        es.close();
      };
    },
    [pushLine]
  );

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span className={styles.logoText}>SubRecon</span>
        </div>
        <p className={styles.tagline}>Passive &amp; active subdomain enumeration</p>
      </header>

      <main className={styles.main}>
        <ScanForm onScan={handleScan} scanning={scanning} apiBase={API_BASE} />

        {(lines.length > 0 || scanning) && (
          <div className={styles.results}>
            <div className={styles.terminalCol}>
              <Terminal lines={lines} scanning={scanning} />
            </div>
            <div className={styles.panelCol}>
              <ResultsPanel
                subdomains={subdomains}
                domain={currentDomain}
                done={scanDone}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
