import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";

export function useBackNavigation(fallback: string) {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(() => {
    if (location.key === "default") {
      navigate(fallback, { replace: true });
      return;
    }
    navigate(-1);
  }, [fallback, location.key, navigate]);
}
