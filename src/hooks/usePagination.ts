import { useState, useMemo, useCallback } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
}

interface UsePaginationReturn<T> {
  // State
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  
  // Computed values
  startIndex: number;
  endIndex: number;
  paginatedData: T[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  
  // Actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  
  // For server-side pagination
  range: { from: number; to: number };
}

export function usePagination<T>(
  data: T[] | undefined,
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const { initialPage = 1, initialPageSize = 50 } = options;
  
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  
  const totalItems = data?.length ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  
  // Ensure current page is valid
  const validPage = useMemo(() => {
    if (currentPage < 1) return 1;
    if (currentPage > totalPages) return totalPages;
    return currentPage;
  }, [currentPage, totalPages]);
  
  // Calculate indexes
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  
  // Paginated data for client-side pagination
  const paginatedData = useMemo(() => {
    if (!data) return [];
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);
  
  // Range for server-side pagination (Supabase .range())
  const range = useMemo(() => ({
    from: startIndex,
    to: endIndex - 1, // Supabase range is inclusive
  }), [startIndex, endIndex]);
  
  // Actions
  const setPage = useCallback((page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
  }, [totalPages]);
  
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);
  
  const nextPage = useCallback(() => {
    if (validPage < totalPages) {
      setCurrentPage(validPage + 1);
    }
  }, [validPage, totalPages]);
  
  const previousPage = useCallback(() => {
    if (validPage > 1) {
      setCurrentPage(validPage - 1);
    }
  }, [validPage]);
  
  const firstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);
  
  const lastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);
  
  return {
    currentPage: validPage,
    pageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    paginatedData,
    hasNextPage: validPage < totalPages,
    hasPreviousPage: validPage > 1,
    setPage,
    setPageSize,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    range,
  };
}

// Hook for server-side pagination with Supabase
export function useServerPagination(options: UsePaginationOptions = {}) {
  const { initialPage = 1, initialPageSize = 50 } = options;
  
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [totalCount, setTotalCount] = useState(0);
  
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;
  
  const range = useMemo(() => ({
    from: startIndex,
    to: endIndex,
  }), [startIndex, endIndex]);
  
  const setPage = useCallback((page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages || 1));
    setCurrentPage(newPage);
  }, [totalPages]);
  
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  }, []);
  
  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(p => p + 1);
    }
  }, [currentPage, totalPages]);
  
  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(p => p - 1);
    }
  }, [currentPage]);
  
  return {
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    range,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    setPage,
    setPageSize,
    setTotalCount,
    nextPage,
    previousPage,
  };
}
