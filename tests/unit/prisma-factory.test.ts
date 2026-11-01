import { describe, expect, it } from "vitest";
import { schemaFromUrl } from "@/server/prisma-factory";

describe("schemaFromUrl", () => {
  it("lê o schema indicado na URL do banco", () => {
    expect(schemaFromUrl("postgresql://u:p@localhost:5432/viva?schema=public")).toBe("public");
    expect(schemaFromUrl("postgresql://u.ref:p@pooler.example.com:6543/postgres?schema=viva&sslmode=no-verify")).toBe("viva");
  });

  it("usa o padrão quando não há schema ou a URL é inválida", () => {
    expect(schemaFromUrl("postgresql://u:p@localhost:5432/viva")).toBeUndefined();
    expect(schemaFromUrl("postgresql://u:p@localhost:5432/viva?schema=")).toBeUndefined();
    expect(schemaFromUrl("não é uma url")).toBeUndefined();
  });
});
