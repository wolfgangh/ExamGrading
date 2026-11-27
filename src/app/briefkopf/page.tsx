"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildHeaderHtml,
  DEFAULT_LETTERHEAD,
  DEFAULT_LOGO_URL,
  letterheadFromFile,
  letterheadToFile,
  loadLetterhead,
  resetLetterhead,
  saveLetterhead,
  type Letterhead,
} from "@/lib/letterhead";
import { downloadBlob } from "@/lib/download";
import { ArrowLeft, Download, RotateCcw, Upload } from "lucide-react";

type FileKey = "customHeaderHtml" | "customHeaderTex" | "customQmd";

const FILE_SLOTS: { key: FileKey; label: string; accept: string; hint: string }[] = [
  {
    key: "customHeaderHtml",
    label: "Eigener HTML-Kopf (Quarto include-before-body)",
    accept: ".html,.htm",
    hint: "Ersetzt den erzeugten Kopf im HTML-Notenspiegel und im Quarto-Paket. Bilder als absolute URL oder Data-URL einbinden.",
  },
  {
    key: "customHeaderTex",
    label: "Eigener LaTeX-Kopf (Quarto include-in-header)",
    accept: ".tex",
    hint: "Für das PDF aus dem Quarto-Paket. Das Logo liegt im Paket als logo.png.",
  },
  {
    key: "customQmd",
    label: "Eigene Quarto-Vorlage Notenspiegel (.qmd)",
    accept: ".qmd",
    hint: "Liest daten.json; Platzhalter wie {{pruefung}} oder {{tabelle_noten}} werden ersetzt (siehe Standardvorlage).",
  },
];

/** „Mein Briefkopf“ – austauschbarer Kopf für alle Dokumente */
export default function LetterheadPage() {
  const [lh, setLh] = useState<Letterhead>(DEFAULT_LETTERHEAD);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const fileRefs = useRef<Record<FileKey, HTMLInputElement | null>>({
    customHeaderHtml: null,
    customHeaderTex: null,
    customQmd: null,
  });

  useEffect(() => {
    setLh(loadLetterhead());
  }, []);

  const preview = useMemo(
    () =>
      lh.customHeaderHtml ??
      buildHeaderHtml(lh, { logoSrc: lh.logoDataUrl ?? DEFAULT_LOGO_URL }),
    [lh]
  );

  const set = (patch: Partial<Letterhead>) => {
    setMsg(null);
    setLh((prev) => ({ ...prev, ...patch }));
  };

  const save = () => {
    saveLetterhead(lh);
    setMsg("Briefkopf gespeichert – gilt für alle neuen Dokumente in diesem Browser.");
  };

  const readFile = (file: File, asDataUrl: boolean): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      if (asDataUrl) r.readAsDataURL(file);
      else r.readAsText(file);
    });

  return (
    <div className="page-shell flex min-h-screen flex-col">
      <AppHeader subtitle="Mein Briefkopf" />
      <main className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mein Briefkopf</h1>
            <p className="text-muted-foreground">
              Kopf für alle PDF-Dokumente und den Notenspiegel (HTML/Quarto).
              Gespeichert in diesem Browser; als Datei an Kollegen weitergeben.
            </p>
          </div>
          <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="size-4" />
            Zur Startseite
          </Link>
        </div>

        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vorschau</CardTitle>
            <CardDescription>
              Im Dokument stehen die Dozenten der Prüfung und der Prüfungsname;
              fehlen sie, gelten Name und Fachzeile von hier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Sandbox: hochgeladener HTML-Kopf ohne Skripte darstellen */}
            <iframe
              title="Vorschau Briefkopf"
              sandbox=""
              srcDoc={`<!DOCTYPE html><html><body style="margin:12px;background:#fff">${preview.replace(
                /src="\/briefkopf\//g,
                `src="${typeof window !== "undefined" ? window.location.origin : ""}/briefkopf/`
              )}</body></html>`}
              className="h-40 w-full rounded-lg border bg-white"
            />
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Angaben</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="lh-inst">Hochschul-/Fakultätszeile</Label>
              <Input id="lh-inst" value={lh.institutionLine} onChange={(e) => set({ institutionLine: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lh-name">Name</Label>
              <Input id="lh-name" value={lh.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lh-link">Link auf den Namen (HTML)</Label>
              <Input id="lh-link" value={lh.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://…" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lh-subject">Standard-Fachzeile</Label>
              <Input id="lh-subject" value={lh.subjectLine} onChange={(e) => set({ subjectLine: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lh-color">Hausfarbe</Label>
              <div className="flex items-center gap-2">
                <input
                  id="lh-color"
                  type="color"
                  value={lh.color}
                  onChange={(e) => set({ color: e.target.value })}
                  className="h-8 w-12 cursor-pointer rounded border"
                />
                <Input value={lh.color} onChange={(e) => set({ color: e.target.value })} className="w-28 font-mono" />
              </div>
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Logo</Label>
              <div className="flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lh.logoDataUrl ?? DEFAULT_LOGO_URL} alt="Logo" className="h-12 w-auto rounded border bg-white p-1" />
                <Button type="button" size="sm" variant="outline" onClick={() => logoRef.current?.click()}>
                  <Upload className="size-4" />
                  Logo hochladen (PNG/JPG)
                </Button>
                {lh.logoDataUrl && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => set({ logoDataUrl: undefined })}>
                    Standard-Logo
                  </Button>
                )}
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    if (f.size > 1_000_000) {
                      setErr("Logo bitte kleiner als 1 MB.");
                      return;
                    }
                    setErr(null);
                    set({ logoDataUrl: await readFile(f, true) });
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Eigene Vorlagen (optional)</CardTitle>
            <CardDescription>
              Für eigene Quarto-Layouts. Ohne Datei werden Kopf und Vorlage aus den
              Angaben oben erzeugt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {FILE_SLOTS.map((slot) => (
              <div key={slot.key} className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{slot.label}</p>
                  <p className="text-xs text-muted-foreground">{slot.hint}</p>
                  <p className="text-xs">{lh[slot.key] ? "Eigene Datei hinterlegt" : "Standard"}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => fileRefs.current[slot.key]?.click()}>
                    <Upload className="size-4" />
                    Hochladen
                  </Button>
                  {lh[slot.key] && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => set({ [slot.key]: undefined })}>
                      Entfernen
                    </Button>
                  )}
                  <input
                    ref={(n) => {
                      fileRefs.current[slot.key] = n;
                    }}
                    type="file"
                    accept={slot.accept}
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      set({ [slot.key]: await readFile(f, false) });
                    }}
                  />
                </div>
              </div>
            ))}
            <a href="/briefkopf/notenspiegel.qmd" download className="text-sm text-primary underline-offset-2 hover:underline">
              Standardvorlage notenspiegel.qmd herunterladen
            </a>
          </CardContent>
        </Card>

        {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
        {msg && <p className="text-sm text-emerald-700 dark:text-emerald-300">{msg}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>Speichern</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void downloadBlob(
                "ExamGrade-Briefkopf.json",
                new Blob([letterheadToFile(lh)], { type: "application/json" })
              )
            }
          >
            <Download className="size-4" />
            Als Datei exportieren
          </Button>
          <Button type="button" variant="outline" onClick={() => importRef.current?.click()}>
            <Upload className="size-4" />
            Datei importieren
          </Button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                setLh(letterheadFromFile(await readFile(f, false)));
                setErr(null);
                setMsg("Briefkopf geladen – zum Übernehmen speichern.");
              } catch (ex) {
                setErr(ex instanceof Error ? ex.message : "Datei ungültig.");
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              resetLetterhead();
              setLh(loadLetterhead());
              setMsg("Auf Standard zurückgesetzt.");
            }}
          >
            <RotateCcw className="size-4" />
            Standard
          </Button>
        </div>
      </main>
    </div>
  );
}
