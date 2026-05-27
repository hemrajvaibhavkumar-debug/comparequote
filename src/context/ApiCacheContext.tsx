import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface ApiCacheContextType {
  comparisons: any[] | null;
  pos: any[] | null;
  masters: any | null;
  companySettings: any | null;
  termsTemplates: any[] | null;
  vendors: any[] | null;
  roles: any[] | null;
  users: any[] | null;
  
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
  
  const [comparisons, setComparisons] = useState<any[] | null>(null);
  const [pos, setPos] = useState<any[] | null>(null);
  const [masters, setMasters] = useState<any | null>(null);
  const [companySettings, setCompanySettings] = useState<any | null>(null);
  const [termsTemplates, setTermsTemplates] = useState<any[] | null>(null);
  const [vendors, setVendors] = useState<any[] | null>(null);
  const [roles, setRoles] = useState<any[] | null>(null);
  const [users, setUsers] = useState<any[] | null>(null);

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

  const fetchComparisons = useCallback(async (force = false) => {
    if (comparisons && !force) return comparisons;
    const data = await handleFetch('/api/comparisons');
    setComparisons(data);
    return data;
  }, [comparisons, handleFetch]);

  const fetchPOs = useCallback(async (force = false) => {
    if (pos && !force) return pos;
    const data = await handleFetch('/api/po');
    setPos(data);
    return data;
  }, [pos, handleFetch]);

  const fetchMasters = useCallback(async (force = false) => {
    if (masters && !force) return masters;
    const data = await handleFetch('/api/masters');
    setMasters(data);
    return data;
  }, [masters, handleFetch]);

  const fetchCompanySettings = useCallback(async (force = false) => {
    if (companySettings && !force) return companySettings;
    const data = await handleFetch('/api/settings/company');
    setCompanySettings(data);
    return data;
  }, [companySettings, handleFetch]);

  const fetchTermsTemplates = useCallback(async (force = false) => {
    if (termsTemplates && !force) return termsTemplates;
    const data = await handleFetch('/api/settings/terms');
    setTermsTemplates(data);
    return data;
  }, [termsTemplates, handleFetch]);

  const fetchVendors = useCallback(async (force = false) => {
    if (vendors && !force) return vendors;
    const data = await handleFetch('/api/settings/vendors');
    setVendors(data);
    return data;
  }, [vendors, handleFetch]);

  const fetchRoles = useCallback(async (force = false) => {
    if (roles && !force) return roles;
    const data = await handleFetch('/api/roles');
    setRoles(data);
    return data;
  }, [roles, handleFetch]);

  const fetchUsers = useCallback(async (force = false) => {
    if (users && !force) return users;
    const data = await handleFetch('/api/users');
    setUsers(data);
    return data;
  }, [users, handleFetch]);

  const invalidateComparisons = useCallback(() => setComparisons(null), []);
  const invalidatePOs = useCallback(() => setPos(null), []);
  const invalidateMasters = useCallback(() => setMasters(null), []);
  const invalidateCompanySettings = useCallback(() => setCompanySettings(null), []);
  const invalidateTermsTemplates = useCallback(() => setTermsTemplates(null), []);
  const invalidateVendors = useCallback(() => setVendors(null), []);
  const invalidateRoles = useCallback(() => setRoles(null), []);
  const invalidateUsers = useCallback(() => setUsers(null), []);

  const invalidateAll = useCallback(() => {
    setComparisons(null);
    setPos(null);
    setMasters(null);
    setCompanySettings(null);
    setTermsTemplates(null);
    setVendors(null);
    setRoles(null);
    setUsers(null);
  }, []);

  return (
    <ApiCacheContext.Provider value={{
      comparisons, pos, masters, companySettings, termsTemplates, vendors, roles, users,
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
