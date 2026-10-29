"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RetryButton() {
  return (
    // O service worker entrega esta página no lugar da original; recarregar tenta a original de novo.
    <Button onClick={() => window.location.reload()} className="self-start">
      <RefreshCw className="h-4 w-4" aria-hidden /> Tentar novamente
    </Button>
  );
}
