export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-full min-h-0 animate-fade-in">{children}</div>;
}
