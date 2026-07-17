"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ExamIndexPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  useEffect(() => {
    if (id) {
      router.replace(`/exam/${id}/overview`);
    }
  }, [id, router]);

  return (
    <p className="text-muted-foreground">Weiterleitung zur Übersicht…</p>
  );
}
