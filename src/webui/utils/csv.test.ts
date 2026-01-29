import { describe, it, expect } from "bun:test";
import { toCSV } from "../utils/csv";

describe("CSV Utility", () => {
  it("should convert simple object array to CSV", () => {
    const data = [
      { id: 1, name: "Alice", role: "Admin" },
      { id: 2, name: "Bob", role: "User" },
    ];
    const csv = toCSV(data);
    expect(csv).toBe("id,name,role\n1,Alice,Admin\n2,Bob,User");
  });

  it("should handle empty array", () => {
    const csv = toCSV([]);
    expect(csv).toBe("");
  });

  it("should escape commas and quotes", () => {
    const data = [
      { name: 'Doe, John', note: 'He said "Hello"' },
    ];
    const csv = toCSV(data);
    expect(csv).toBe('name,note\n"Doe, John","He said ""Hello"""');
  });

  it("should handle null and undefined values", () => {
    const data = [
      { id: 1, name: null, note: undefined },
    ];
    const csv = toCSV(data);
    expect(csv).toBe("id,name,note\n1,,");
  });
});
