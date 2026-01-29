/**
 * Simple CSV generation utility
 */

/**
 * Converts an array of objects to a CSV string
 * @param data Array of objects to convert
 * @returns CSV string
 */
export function toCSV<T extends Record<string, any>>(data: T[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const rows = data.map((obj) => {
    return headers.map((header) => {
      const value = obj[header];
      if (value === null || value === undefined) return "";
      
      const stringValue = String(value);
      // Escape quotes and wrap in quotes if contains comma, newline or quotes
      if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes("\"")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
  });

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}
