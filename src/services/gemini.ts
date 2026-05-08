import { ComparisonData } from "../types";

export async function extractQuotations(input: string, files?: { mimeType: string, data: string }[], existingItems?: string[]): Promise<ComparisonData> {
  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input, files, existingItems }),
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
