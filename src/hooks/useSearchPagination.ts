import { useMemo, useState } from "react";

interface UseSearchPaginationOptions<T> {
  data: T[] | undefined;
  pageSize?: number;
  getSearchableFields: (item: T) => Array<string | null | undefined>;
}

interface UseSearchPaginationReturn<T> {
  search: string;
  setSearch: (value: string) => void;
  page: number;
  setPage: (value: number | ((prev: number) => number)) => void;
  currentPage: number;
  totalPages: number;
  paginated: T[];
  filtered: T[];
  isSearching: boolean;
  totalCount: number;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
}

export function useSearchPagination<T>({
  data,
  pageSize = 10,
  getSearchableFields,
}: UseSearchPaginationOptions<T>): UseSearchPaginationReturn<T> {
  const [search, setSearchRaw] = useState("");
  const [page, setPage] = useState(1);

  const setSearch = (value: string) => {
    setSearchRaw(value);
    setPage(1);
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((item) =>
      getSearchableFields(item).some((field) =>
        (field ?? "").toString().toLowerCase().includes(term),
      ),
    );
  }, [data, search, getSearchableFields]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  return {
    search,
    setSearch,
    page,
    setPage,
    currentPage,
    totalPages,
    paginated,
    filtered,
    isSearching: search.trim().length > 0,
    totalCount: data?.length ?? 0,
    goToPreviousPage: () => setPage((p) => Math.max(1, p - 1)),
    goToNextPage: () => setPage((p) => Math.min(totalPages, p + 1)),
  };
}
