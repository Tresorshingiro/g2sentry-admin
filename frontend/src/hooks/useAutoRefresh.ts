import { useCallback, useEffect, useState } from 'react';

export function useAutoRefresh(intervalSeconds: number, onRefresh: () => void) {
  const [countdown, setCountdown] = useState(intervalSeconds);

  const refresh = useCallback(() => {
    setCountdown(intervalSeconds);
    onRefresh();
  }, [intervalSeconds, onRefresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRefresh();
          return intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [intervalSeconds, onRefresh]);

  return { countdown, refresh };
}
