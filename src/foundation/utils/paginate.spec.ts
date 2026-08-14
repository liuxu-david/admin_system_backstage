import { normalizePagination, buildPaginatedResult } from "./paginate";

describe("Pagination Utils", () => {
  describe("normalizePagination", () => {
    it("should return defaults when no options provided", () => {
      const result = normalizePagination({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(0);
      expect(result.take).toBe(20);
    });

    it("should clamp page to minimum of 1", () => {
      const result = normalizePagination({ page: -1 });
      expect(result.page).toBe(1);
      expect(result.skip).toBe(0);
    });

    it("should clamp limit to maximum of 100", () => {
      const result = normalizePagination({ limit: 500 });
      expect(result.limit).toBe(100);
    });

    it("should calculate skip correctly", () => {
      const result = normalizePagination({ page: 3, limit: 10 });
      expect(result.skip).toBe(20);
      expect(result.take).toBe(10);
    });
  });

  describe("buildPaginatedResult", () => {
    it("should build correct paginated result", () => {
      const items = [1, 2, 3];
      const result = buildPaginatedResult(items, 30, 2, 10);

      expect(result.items).toEqual([1, 2, 3]);
      expect(result.total).toBe(30);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
    });
  });
});
