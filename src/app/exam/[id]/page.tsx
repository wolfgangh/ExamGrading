"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExamIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/exam/${id}/overview`);
  }, [id, router]);

  return (
    <p className="text-muted-foreground">Weiterleitung zur Übersicht…</p>
  );
}
