import { Suspense } from "react";
import { Loader } from "@/components/Mascot";
import CheckView from "./CheckView";

// The check id lives in ?id=, read on the client (static export).
export default function CheckPage() {
  return (
    <Suspense fallback={<main><Loader label="Loading Plot Check…" /></main>}>
      <CheckView />
    </Suspense>
  );
}
