"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
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
  isAppPasswordConfigured,
  setAuthenticated,
  verifyPassword,
} from "@/lib/app-auth";
import { Lock, Loader2 } from "lucide-react";

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Kurzes Loading für UX (Prüfung ist synchron)
    window.setTimeout(() => {
      if (!isAppPasswordConfigured()) {
        setError(
          "App-Passwort ist nicht konfiguriert. Lokal: .env.local mit NEXT_PUBLIC_APP_PASSWORD anlegen und Dev-Server neu starten."
        );
        setLoading(false);
        return;
      }
      if (verifyPassword(password)) {
        setAuthenticated();
        onSuccess();
      } else {
        setError("Passwort ist nicht korrekt.");
        setLoading(false);
      }
    }, 200);
  };

  return (
    <div className="page-shell flex min-h-screen items-center justify-center p-4">
      <Card className="surface-panel w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            EG
          </div>
          <div>
            <CardTitle className="text-xl tracking-tight">ExamGrade</CardTitle>
            <CardDescription className="mt-1.5">
              Prüfungsnoten-Tool · OTH Regensburg
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Bitte Passwort eingeben, um fortzufahren.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="app-password">Passwort</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="app-password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  className="pl-9"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={loading}
                  placeholder="Passwort"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !password.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Prüfe…
                </>
              ) : (
                "Anmelden"
              )}
            </Button>
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Nur eine Zugangshürde im Browser – das Passwort steckt im
              App-Bundle und ist kein serverseitiger Geheimnisschutz.
              Prüfungsdaten bleiben lokal in diesem Browser (keine
              Serverübertragung).
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
