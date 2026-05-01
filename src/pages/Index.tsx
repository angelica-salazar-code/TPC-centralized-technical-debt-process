import { lazy, Suspense } from "react";
import { useAppState } from "@/lib/appState";
import { VariantSwitcher } from "@/components/VariantSwitcher";

const CouncilVariant = lazy(() => import("@/variants/council/CouncilVariant"));
const AtlasVariant = lazy(() => import("@/variants/atlas/AtlasVariant"));

const Index = () => {
  const { variant } = useAppState();
  return (
    <>
      <VariantSwitcher />
      <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading variant…</div>}>
        {variant === "council" && <CouncilVariant />}
        {variant === "atlas" && <AtlasVariant />}
      </Suspense>
    </>
  );
};

export default Index;
