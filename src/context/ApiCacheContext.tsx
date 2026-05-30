import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ApiCacheContextType {
  // Methods for backward compatibility
  fetchComparisons: (force?: boolean) => Promise<any[]>;
  fetchPOs: (force?: boolean) => Promise<any[]>;
  fetchMasters: (force?: boolean) => Promise<any>;
  fetchCompanySettings: (force?: boolean) => Promise<any>;
  fetchTermsTemplates: (force?: boolean) => Promise<any[]>;
  fetchVendors: (force?: boolean) => Promise<any[]>;
  fetchRoles: (force?: boolean) => Promise<any[]>;
  fetchUsers: (force?: boolean) => Promise<any[]>;

  invalidateComparisons: () => void;
  invalidatePOs: () => void;
  invalidateMasters: () => void;
  invalidateCompanySettings: () => void;
  invalidateTermsTemplates: () => void;
  invalidateVendors: () => void;
  invalidateRoles: () => void;
  invalidateUsers: () => void;
  invalidateAll: () => void;
}

const ApiCacheContext = createContext<ApiCacheContextType | undefined>(undefined);

export const ApiCacheProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();
  
  const handleFetch = useCallback(async (url: string) => {
    if (!token) throw new Error("No authorization token");
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.status === 401 || res.status === 403) {
      logout();
      throw new Error("Session expired");
    }
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }, [token, logout]);

  // Compatibility methods using queryClient directly
  const fetchComparisons = useCallback(async (force = false) => {
    if (force) queryClient.invalidateQueries({ queryKey: ['comparisons'] });
    return queryClient.ensureQueryData({
      queryKey: ['comparisons'],
      queryFn: () => handleFetch('/api/comparisons')
    });
  }, [queryClient, handleFetch]);

  const fetchPOs = useCallback(async (force = false) => {
    if (force) queryClient.invalidateQueries({ queryKey: ['pos'] });
    return queryClient.ensureQueryData({
      queryKey: ['pos'],
      queryFn: () => handleFetch('/api/po')
    });
  }, [queryClient, handleFetch]);

  const fetchMasters = useCallback(async (force = false) => {
    if (force) queryClient.invalidateQueries({ queryKey: ['masters'] });
    return queryClient.ensureQueryData({
      queryKey: ['masters'],
      queryFn: () => handleFetch('/api/masters')
    });
  }, [queryClient, handleFetch]);

  const fetchCompanySettings = useCallback(async (force = false) => {
    if (force) queryClient.invalidateQueries({ queryKey: ['companySettings'] });
    return queryClient.ensureQueryData({
      queryKey: ['companySettings'],
      queryFn: () => handleFetch('/api/settings/company')
    });
  }, [queryClient, handleFetch]);

  const fetchTermsTemplates = useCallback(async (force = false) => {
    if (force) queryClient.invalidateQueries({ queryKey: ['termsTemplates'] });
    return queryClient.ensureQueryData({
      queryKey: ['termsTemplates'],
      queryFn: () => handleFetch('/api/settings/terms')
    });
  }, [queryClient, handleFetch]);

  const fetchVendors = useCallback(async (force = false) => {
    if (force) queryClient.invalidateQueries({ queryKey: ['vendors'] });
    return queryClient.ensureQueryData({
      queryKey: ['vendors'],
      queryFn: () => handleFetch('/api/settings/vendors')
    });
  }, [queryClient, handleFetch]);

  const fetchRoles = useCallback(async (force = false) => {
    if (force) queryClient.invalidateQueries({ queryKey: ['roles'] });
    return queryClient.ensureQueryData({
      queryKey: ['roles'],
      queryFn: () => handleFetch('/api/roles')
    });
  }, [queryClient, handleFetch]);

  const fetchUsers = useCallback(async (force = false) => {
    if (force) queryClient.invalidateQueries({ queryKey: ['users'] });
    return queryClient.ensureQueryData({
      queryKey: ['users'],
      queryFn: () => handleFetch('/api/users')
    });
  }, [queryClient, handleFetch]);

  const invalidateComparisons = useCallback(() => queryClient.invalidateQueries({ queryKey: ['comparisons'] }), [queryClient]);
  const invalidatePOs = useCallback(() => queryClient.invalidateQueries({ queryKey: ['pos'] }), [queryClient]);
  const invalidateMasters = useCallback(() => queryClient.invalidateQueries({ queryKey: ['masters'] }), [queryClient]);
  const invalidateCompanySettings = useCallback(() => queryClient.invalidateQueries({ queryKey: ['companySettings'] }), [queryClient]);
  const invalidateTermsTemplates = useCallback(() => queryClient.invalidateQueries({ queryKey: ['termsTemplates'] }), [queryClient]);
  const invalidateVendors = useCallback(() => queryClient.invalidateQueries({ queryKey: ['vendors'] }), [queryClient]);
  const invalidateRoles = useCallback(() => queryClient.invalidateQueries({ queryKey: ['roles'] }), [queryClient]);
  const invalidateUsers = useCallback(() => queryClient.invalidateQueries({ queryKey: ['users'] }), [queryClient]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  return (
    <ApiCacheContext.Provider value={{
      fetchComparisons, fetchPOs, fetchMasters, fetchCompanySettings, fetchTermsTemplates, fetchVendors, fetchRoles, fetchUsers,
      invalidateComparisons, invalidatePOs, invalidateMasters, invalidateCompanySettings, invalidateTermsTemplates, invalidateVendors, invalidateRoles, invalidateUsers, invalidateAll
    }}>
      {children}
    </ApiCacheContext.Provider>
  );
};

export const useApiCache = () => {
  const context = useContext(ApiCacheContext);
  if (context === undefined) {
    throw new Error('useApiCache must be used within an ApiCacheProvider');
  }
  return context;
};

// New Hooks for future direct usage
export const useComparisons = () => {
  const { token, logout } = useAuth();
  return useQuery({
    queryKey: ['comparisons'],
    queryFn: async () => {
      const res = await fetch('/api/comparisons', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) logout();
      return res.json();
    },
    enabled: !!token
  });
};

export const usePOs = () => {
  const { token, logout } = useAuth();
  return useQuery({
    queryKey: ['pos'],
    queryFn: async () => {
      const res = await fetch('/api/po', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) logout();
      return res.json();
    },
    enabled: !!token
  });
};
