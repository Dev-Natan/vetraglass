import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RateLimitStatus {
  isBlocked: boolean;
  failedAttempts: number;
  maxAttempts: number;
  remainingSeconds: number;
}

export function useRateLimiting() {
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkRateLimit = useCallback(async (email: string): Promise<RateLimitStatus | null> => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.rpc('check_login_rate_limit', {
        _email: email.toLowerCase().trim(),
        _max_attempts: 5,
        _window_minutes: 15
      });

      if (error) {
        console.error('Error checking rate limit:', error);
        return null;
      }

      // Type assertion for the JSONB response
      const result = data as { 
        is_blocked?: boolean; 
        failed_attempts?: number; 
        max_attempts?: number; 
        remaining_seconds?: number; 
      } | null;

      const status: RateLimitStatus = {
        isBlocked: result?.is_blocked ?? false,
        failedAttempts: result?.failed_attempts ?? 0,
        maxAttempts: result?.max_attempts ?? 5,
        remainingSeconds: result?.remaining_seconds ?? 0
      };

      setRateLimitStatus(status);
      return status;
    } catch (err) {
      console.error('Error checking rate limit:', err);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const recordLoginAttempt = useCallback(async (email: string, success: boolean) => {
    try {
      await supabase.rpc('record_login_attempt', {
        _email: email.toLowerCase().trim(),
        _success: success,
        _ip_address: null, // Cannot get client IP from browser
        _user_agent: navigator.userAgent
      });

      // Reset status on successful login
      if (success) {
        setRateLimitStatus(null);
      }
    } catch (err) {
      console.error('Error recording login attempt:', err);
    }
  }, []);

  const formatRemainingTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  }, []);

  return {
    rateLimitStatus,
    isChecking,
    checkRateLimit,
    recordLoginAttempt,
    formatRemainingTime
  };
}
