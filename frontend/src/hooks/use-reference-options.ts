import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export function useReferenceOptions() {
  const experimentersQuery = useQuery({
    queryKey: ['reference', 'experimenters'],
    queryFn: () => api.listExperimenters()
  });

  const pmOwnersQuery = useQuery({
    queryKey: ['reference', 'pmOwners'],
    queryFn: () => api.listPmOwners()
  });

  const seqTypesQuery = useQuery({
    queryKey: ['reference', 'seqTypes'],
    queryFn: () => api.listSeqTypes()
  });

  const experimenters = useMemo(
    () => (experimentersQuery.data?.items || []).filter((e) => e.isActive),
    [experimentersQuery.data]
  );

  const pmOwners = useMemo(
    () => (pmOwnersQuery.data?.items || []).filter((p) => p.isActive),
    [pmOwnersQuery.data]
  );

  const seqTypeOptions = useMemo(
    () => (Array.isArray(seqTypesQuery.data?.all) ? seqTypesQuery.data?.all : []),
    [seqTypesQuery.data]
  );

  return {
    experimenters,
    pmOwners,
    seqTypeOptions,
    loading: experimentersQuery.isPending || pmOwnersQuery.isPending || seqTypesQuery.isPending
  };
}
