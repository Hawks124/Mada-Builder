import { Navbar } from "@/components/navbar";

// Public shell — global navbar + content wrapper.
// Authenticated areas live under (dashboard) without this navbar.
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-1 flex flex-col w-full relative">{children}</main>
    </>
  );
}
