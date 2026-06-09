import { ComparisonData } from "../types";

export async function extractQuotations(input: string, files?: { mimeType: string, data: string }[], userPrompt?: string, token?: string): Promise<ComparisonData> {
  const headers: any = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/extract', {
    method: 'POST',
    headers,
    body: JSON.stringify({ input, files, userPrompt }),
  });

  if (!response.ok) {
    let errorMessage = `Server error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      // If response is not JSON (e.g., a 404 HTML page), use the default message
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
