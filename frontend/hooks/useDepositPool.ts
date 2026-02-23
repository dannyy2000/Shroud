"use client";

import { useState, useEffect, useCallback } from "react";
import { getDepositPoolContract, poolTierEnum } from "~~/lib/contracts";

export function useDepositCounts() {
  const [counts, setCounts] = useState<number[]>([0, 0, 0]);
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    try {
      const contract = getDepositPoolContract();
      const results = await Promise.all([
        contract.get_deposit_count(poolTierEnum(0)),
        contract.get_deposit_count(poolTierEnum(1)),
        contract.get_deposit_count(poolTierEnum(2)),
      ]);
      setCounts(results.map((r) => Number(r)));
    } catch (err) {
      console.error("Failed to fetch deposit counts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { counts, loading, refetch: fetchCounts };
}
