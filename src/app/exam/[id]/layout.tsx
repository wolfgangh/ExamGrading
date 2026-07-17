import { ExamClientLayout } from "./exam-client-layout";

/**
 * Server Layout: params werden hier awaited (Next.js 15 / Vercel-sicher).
 * Die UI bleibt client-seitig in ExamClientLayout.
 */
export default async function ExamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExamClientLayout examId={id}>{children}</ExamClientLayout>;
}
