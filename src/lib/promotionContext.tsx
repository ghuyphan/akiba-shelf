import { createContext, useContext, type ReactNode } from "react";
import { defaultPromotion } from "./constants";
import type { PromotionSettings } from "../types/catalog";

const PromotionContext = createContext<PromotionSettings>(defaultPromotion);

export function PromotionProvider({
  promotion,
  children,
}: {
  promotion: PromotionSettings;
  children: ReactNode;
}) {
  return (
    <PromotionContext.Provider value={promotion}>
      {children}
    </PromotionContext.Provider>
  );
}

export function usePromotion() {
  return useContext(PromotionContext);
}
