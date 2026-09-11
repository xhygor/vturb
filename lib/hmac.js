// Helpers de assinatura HMAC-SHA256 usados tanto pelo middleware (validação)
// quanto pela função de assinatura (/api/sign-embed). Só usa Web Crypto padrão
// para funcionar tanto no Edge Runtime da Vercel quanto em runtimes Node modernos.

const encoder = new TextEncoder();

// Serializa os parâmetros de forma determinística (ordem de chaves não importa
// na entrada, mas o resultado é sempre o mesmo para o mesmo conjunto de dados).
// Ignora o próprio campo "sig" para nunca assinar a assinatura.
export function canonicalString(paramsObj) {
  const keys = Object.keys(paramsObj).filter((k) => k !== 'sig').sort();
  const pairs = keys.map((k) => [k, String(paramsObj[k])]);
  return JSON.stringify(pairs);
}

function toBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hmacSign(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toBase64Url(signature);
}

// Deriva uma chave específica para um vídeo+versão a partir do segredo mestre
// (mesma ideia da derivação em cadeia usada pela AWS SigV4: HMAC do segredo
// mestre com um identificador do recurso vira a chave usada pra assinar esse
// recurso). Bumping "keyVersion" troca a chave derivada e invalida, de uma vez,
// todas as assinaturas emitidas com a versão anterior — sem afetar outros vídeos.
export async function deriveVideoKey(masterSecret, videoId, keyVersion) {
  return hmacSign(masterSecret, `${videoId}:${keyVersion}`);
}

// Comparação em tempo constante (evita vazar informação por timing ao comparar
// a assinatura recebida com a esperada).
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
