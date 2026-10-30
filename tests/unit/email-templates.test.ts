import { describe, expect, it } from "vitest";
import { escapeHtml, resetPasswordEmail, verifyEmailEmail } from "@/server/email/templates";

describe("modelos de e-mail", () => {
  it("escapa HTML de nomes e links", () => {
    expect(escapeHtml(`<b>"Ana" & 'Bia'</b>`)).toBe("&lt;b&gt;&quot;Ana&quot; &amp; &#39;Bia&#39;&lt;/b&gt;");
    const mail = resetPasswordEmail({ name: "<script>x</script> Silva", url: "https://viva.test/redefinir-senha?token=a&b", validMinutes: 60 });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("token=a&amp;b");
    expect(mail.text).toContain("https://viva.test/redefinir-senha?token=a&b");
    expect(mail.text).toContain("60 minutos");
  });

  it("tem assunto e versão em texto puro", () => {
    const mail = verifyEmailEmail({ name: "Bia Souza", url: "https://viva.test/api/auth/verify-email?token=x" });
    expect(mail.subject).toBe("Confirme seu e-mail no VIVA");
    expect(mail.text).toMatch(/^Olá, Bia!/);
  });
});
