import { describe, expect, it } from "vitest";
import { toStrictSchema } from "./llm";

type Obj = Record<string, unknown>;

describe("toStrictSchema (OpenAI strict Structured Outputs)", () => {
  it("adds additionalProperties:false and requires all keys, recursively", () => {
    const s = toStrictSchema({
      type: "object",
      properties: {
        a: { type: "string" },
        nested: { type: "object", properties: { b: { type: "integer" } } },
        list: {
          type: "array",
          items: { type: "object", properties: { c: { type: "string" } } },
        },
      },
    });
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(["a", "nested", "list"]);

    const props = s.properties as Record<string, Obj>;
    expect(props.nested.additionalProperties).toBe(false);
    expect(props.nested.required).toEqual(["b"]);

    const items = props.list.items as Obj;
    expect(items.additionalProperties).toBe(false);
    expect(items.required).toEqual(["c"]);
  });

  it("does not mutate the input schema", () => {
    const input: Obj = {
      type: "object",
      properties: { a: { type: "string" } },
    };
    toStrictSchema(input);
    expect(input).not.toHaveProperty("additionalProperties");
    expect(input).not.toHaveProperty("required");
  });

  it("leaves enums and primitive leaves intact", () => {
    const s = toStrictSchema({
      type: "object",
      properties: { k: { type: "string", enum: ["fix", "polish"] } },
    });
    const props = s.properties as Record<string, Obj>;
    expect(props.k.enum).toEqual(["fix", "polish"]);
  });
});
