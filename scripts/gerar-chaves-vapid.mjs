// Gera o par de chaves VAPID para notificações push (gratuitas, sem conta externa).
// Uso: npm run push:chaves  → copie as linhas para o .env do servidor.
import webpush from "web-push";
import { randomBytes } from "node:crypto";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log("# Notificações push (cole no .env do servidor; não versione a chave privada)");
console.log(`VAPID_PUBLIC_KEY="${publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${privateKey}"`);
console.log('VAPID_SUBJECT="mailto:contato@seudominio.com.br"');
console.log(`CRON_SECRET="${randomBytes(24).toString("base64url")}"`);
