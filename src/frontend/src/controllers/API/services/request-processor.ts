import {
  type QueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  MutationFunctionType,
  QueryFunctionType,
} from "../../../types/api";

export function UseRequestProcessor(): {
  query: QueryFunctionType;
  mutate: MutationFunctionType;
  queryClient: QueryClient;
} {
  const queryClient = useQueryClient();

  function query<
    TQueryFnData = unknown,
    TError = Error,
    TData = TQueryFnData,
    TQueryKey extends import("@tanstack/react-query").QueryKey = import("@tanstack/react-query").QueryKey,
  >(
    queryKey: TQueryKey,
    queryFn: import("@tanstack/react-query").QueryFunction<TQueryFnData, TQueryKey>,
    options: Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, "queryFn" | "queryKey"> = {},
  ): UseQueryResult<TData, TError> {
    return useQuery<TQueryFnData, TError, TData, TQueryKey>({
      queryKey,
      queryFn,
      retry: 5,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      ...options,
    });
  }

  function mutate<
    TData = unknown,
    TError = Error,
    TVariables = void,
    TContext = unknown,
  >(
    mutationKey: import("@tanstack/react-query").UseMutationOptions<TData, TError, TVariables, TContext>["mutationKey"],
    mutationFn: import("@tanstack/react-query").UseMutationOptions<TData, TError, TVariables, TContext>["mutationFn"],
    options: Omit<import("@tanstack/react-query").UseMutationOptions<TData, TError, TVariables, TContext>, "mutationFn" | "mutationKey"> = {},
  ): UseMutationResult<TData, TError, TVariables, TContext> {
    return useMutation<TData, TError, TVariables, TContext>({
      mutationKey,
      mutationFn,
      ...options,
      onSettled: (...args) => {
        queryClient.invalidateQueries({ queryKey: mutationKey });
        if (options.onSettled) {
          options.onSettled(...args);
        }
      },
      retry: options.retry ?? 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
  }

  return { query, mutate, queryClient };
}
