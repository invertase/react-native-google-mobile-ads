export type AdapterResponseError = { domain: string; code: number; message: string };

/**
 * Fields every waterfall row reports, whether or not that row failed.
 * Latency on failed rows is what makes waterfall debugging useful, so these
 * are never dropped in the error case.
 */
export type AdapterResponseInfoBase = {
  adapterClassName: string;
  adSourceName: string | null;
  adSourceId: string | null;
  adSourceInstanceName: string | null;
  adSourceInstanceId: string | null;
  latencyMillis: number;
};

/**
 * One waterfall row. `outcome` narrows `adError` without pretending the shared
 * adapter identity and latency fields disappear when a row fails.
 */
export type AdapterResponseInfo = AdapterResponseInfoBase &
  ({ outcome: 'success'; adError: null } | { outcome: 'error'; adError: AdapterResponseError });

/**
 * The winning row. A loaded response cannot carry an error, so `adError` is
 * statically `null` and needs no consumer null-check.
 */
export type LoadedAdapterResponseInfo = AdapterResponseInfoBase & {
  outcome: 'success';
  adError: null;
};

export type ResponseInfoExtras = {
  mediationGroupName?: string;
  mediationAbTestName?: string;
  mediationAbTestVariant?: string;
  creativeId?: string;
  lineItemId?: string;
};

export type ResponseInfo = {
  responseId: string | null;
  adapterClassName: string | null;
  /** `null` when nothing loaded; never an error row. */
  loadedAdapterResponse: LoadedAdapterResponseInfo | null;
  adapterResponses: AdapterResponseInfo[];
  extras: ResponseInfoExtras;
};

export type PaidResponseInfo = Pick<
  ResponseInfo,
  'responseId' | 'adapterClassName' | 'loadedAdapterResponse' | 'extras'
>;
