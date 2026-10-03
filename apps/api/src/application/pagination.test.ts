import assert from "node:assert/strict";
import { test } from "node:test";
import { pageRows, parsePaginationQuery } from "./pagination.js";

test("pagination defaults to a bounded first page", () => {
  assert.deepEqual(parsePaginationQuery({}), { limit: 50, offset: 0 });
});

test("pagination accepts bounded limit and offset", () => {
  assert.deepEqual(parsePaginationQuery({ limit: "25", offset: "50" }), { limit: 25, offset: 50 });
});

test("pagination rejects unsafe values", () => {
  assert.throws(() => parsePaginationQuery({ limit: "201" }), /معاملات التصفح غير صالحة/);
  assert.throws(() => parsePaginationQuery({ offset: "-1" }), /معاملات التصفح غير صالحة/);
});

test("pageRows reports whether another page exists", () => {
  const page = pageRows(["a", "b", "c"], { limit: 2, offset: 0 });
  assert.deepEqual(page.rows, ["a", "b"]);
  assert.deepEqual(page.meta, { limit: 2, offset: 0, hasMore: true });
});

test("pageRows keeps the final partial page", () => {
  const page = pageRows(["a"], { limit: 2, offset: 2 });
  assert.deepEqual(page.rows, ["a"]);
  assert.deepEqual(page.meta, { limit: 2, offset: 2, hasMore: false });
});
