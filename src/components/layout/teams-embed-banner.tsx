"use client";

import { useEffect, useState } from "react";
import { isLikelyTeamsOrIframeEmbed } from "@/lib/download";
import { ExternalLink, X } from "lucide-react";

const DISMISS_KEY = "examgrade-teams-banner-dismissed";

/**
 * Hinweis, wenn die App in MS Teams / iframe läuft:
 * Datei-Downloads sind oft eingeschränkt.
 */
export function TeamsEmbedBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    if (isLikelyTeamsOrIframeEmbed()) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-start gap-3 border-b border-sky-600/40 bg-sky-50 px-4 py-2.5 text-sm text-sky-950 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-50"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">Eingebettete Ansicht (z. B. MS Teams)</p>
        <p className="opacity-95">
          Datei-Exporte (HIS, PDF, Sicherung) können hier blockiert sein. Beim
          Export erscheint ggf. ein Speichern-Dialog oder ein Link am unteren
          Rand. Zuverlässig:{" "}
          <strong>im Browser öffnen</strong> (Teams: ⋯ am Tab → „Im Browser
          öffnen“) und dort exportieren.
        </p>
        <a
          href={typeof window !== "undefined" ? window.location.href : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium underline underline-offset-2"
        >
          <ExternalLink className="size-3.5" />
          Diese Seite im Browser öffnen
        </a>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-md p-1 hover:bg-sky-200/60 dark:hover:bg-sky-900"
        aria-label="Hinweis schließen"
        onClick={() => {
          setShow(false);
          try {
            sessionStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* ignore */
          }
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
