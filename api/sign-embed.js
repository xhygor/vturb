// Assina os parâmetros de um embed de player com PLAYER_SIGNING_SECRET.
// Esta rota fica atrás do Basic Auth do middleware.js (mesmo matcher que protege
// o dashboard), então só quem já tem usuário/senha do painel consegue gerar
// assinaturas válidas para qualquer vídeo.
import { canonicalString, hmacSign, deriveVideoKey } from '../lib/hmac.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST' },
    });
  }

  const secret = process.env.PLAYER_SIGNING_SECRET;
  if (!secret) {
    // Recurso de assinatura desligado: devolve sig nula para o dashboard
    // gerar um link sem assinatura (o middleware também deixa passar sem
    // assinatura nesse caso, então tudo continua funcionando).
    return new Response(JSON.stringify({ sig: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const params = body && body.params;
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return new Response(JSON.stringify({ error: 'missing_params' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // "id" (id do vídeo) e "kv" (versão da chave, incrementada ao revogar
  // embeds antigos) precisam estar entre os parâmetros: eles decidem qual
  // chave derivada é usada pra assinar, e por estarem dentro do payload
  // assinado, não podem ser trocados depois sem invalidar a assinatura.
  if (!params.id || !params.kv) {
    return new Response(JSON.stringify({ error: 'missing_id_or_kv' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const videoKey = await deriveVideoKey(secret, params.id, params.kv);
  const sig = await hmacSign(videoKey, canonicalString(params));
  return new Response(JSON.stringify({ sig }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
