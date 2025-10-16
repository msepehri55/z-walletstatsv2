import dynamic from "next/dynamic";

const MainClientDirect = dynamic(() => import("@/components/MainClientDirect"), { ssr: false });

export default function Home() {
  return (
    <div className="space-y-5">
      <MainClientDirect />
    </div>
  );
}