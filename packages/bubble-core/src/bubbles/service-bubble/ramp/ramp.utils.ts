const RAMP_BASE_URL = 'https://api.ramp.com/developer/v1';

export interface RampApiResponse {
  data?: unknown[];
  page?: { next?: string | null };
  [key: string]: unknown;
}

export async function makeRampRequest(
  accessToken: string,
  endpoint: string,
  options: {
    method?: string;
    params?: Record<string, string | number | undefined>;
    body?: Record<string, unknown>;
  } = {}
): Promise<RampApiResponse> {
  const { method = 'GET', params, body } = options;

  let url = `${RAMP_BASE_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) {
      url += `?${qs}`;
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Ramp API error (${response.status}): ${errorText}`);
  }

  return (await response.json()) as RampApiResponse;
}
