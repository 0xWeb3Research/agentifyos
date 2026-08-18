"use client";

import { useCallback, useState } from "react";
import { NightpassRun } from "./nightpass-run";
import { NightpassVerifier, type VerifierPrefill } from "./nightpass-verifier";

/**
 * Holds the run and the verifier together so a visitor can hand the pass they
 * just bought straight into the auditor's seat. Doing the run and then checking
 * someone else's numbers would prove nothing; checking your own is the point.
 */
export function NightpassConsole() {
  const [prefill, setPrefill] = useState<VerifierPrefill | null>(null);

  const adopt = useCallback((p: VerifierPrefill) => {
    setPrefill({ ...p });
    document.getElementById("nightpass-verify")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="mt-6 grid gap-3">
      <NightpassRun onAudit={adopt} />
      <div id="nightpass-verify" className="scroll-mt-20">
        <NightpassVerifier prefill={prefill} />
      </div>
    </div>
  );
}
