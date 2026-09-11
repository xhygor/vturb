// Vercel Edge Middleware:
//  1) Protege o dashboard ("/" e "/index.html") e a rota de assinatura
//     ("/api/sign-embed") com HTTP Basic Auth.
//  2) Valida a assinatura HMAC ("sig") de cada request a "/player.html" —
//     assinada com uma chave derivada por vídeo (id + versão), pra impedir
//     que terceiros montem na mão links apontando pros seus vídeos ou alterem
//     parâmetros (ex: link de checkout) de um link copiado, e pra permitir
//     revogar só os links antigos de um vídeo específico (bumping a versão).
//  3) Se o vídeo tiver uma lista de domínios permitidos, só deixa o player
//     carregar quando embutido (via <iframe>) num desses domínios.
//
// Variáveis de ambiente (Project Settings > Environment Variables na Vercel):
//   BASIC_AUTH_USER        obrigatório para acessar o dashboard
//   BASIC_AUTH_PASS        obrigatório para acessar o dashboard
//   PLAYER_SIGNING_SECRET  opcional: se não configurado, a validação de
//                          assinatura e de domínio do player ficam desligadas
//                          (fail-open) e qualquer link para /player.html
//                          funciona sem "sig".

import { canonicalString, hmacSign, timingSafeEqual, deriveVideoKey } from './lib/hmac.js';

export const config = {
  matcher: ['/', '/index.html', '/api/sign-embed', '/player.html'],
};

export default async function middleware(request) {
  const url = new URL(request.url);

  if (url.pathname === '/player.html') {
    return checkPlayerSignature(request, url.searchParams);
  }

  return checkBasicAuth(request);
}

function checkBasicAuth(request) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;

  if (!expectedUser || !expectedPass) {
    return new Response(
      'Dashboard protegido: configure BASIC_AUTH_USER e BASIC_AUTH_PASS nas ' +
      'variáveis de ambiente do projeto na Vercel e faça o redeploy.',
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.slice('Basic '.length));
      const sep = decoded.indexOf(':');
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      if (user === expectedUser && pass === expectedPass) {
        return; // credenciais corretas: deixa a requisição continuar normalmente
      }
    } catch (e) {
      // authorization header malformado: cai para o 401 abaixo
    }
  }

  return new Response('Autenticação necessária.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="VSL Player Dashboard", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function textResponse(body, status) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function checkPlayerSignature(request, searchParams) {
  const secret = process.env.PLAYER_SIGNING_SECRET;
  if (!secret) return; // assinatura desligada: deixa o player carregar normalmente

  const provided = searchParams.get('sig');
  const id = searchParams.get('id');
  const kv = searchParams.get('kv');
  if (!provided || !id || !kv) {
    return textResponse('Link inválido: parâmetros de segurança ausentes.', 403);
  }

  const paramsObj = {};
  for (const [key, value] of searchParams.entries()) {
    if (key !== 'sig') paramsObj[key] = value;
  }

  const videoKey = await deriveVideoKey(secret, id, kv);
  const expected = await hmacSign(videoKey, canonicalString(paramsObj));
  if (!timingSafeEqual(expected, provided)) {
    // ou a assinatura foi forjada, ou os parâmetros foram adulterados,
    // ou os links antigos desse vídeo foram revogados (kv mudou)
    return textResponse('Link inválido, adulterado ou revogado.', 403);
  }

  if (!isDomainAllowed(request, searchParams.get('domains'))) {
    return textResponse('Link inválido: domínio não autorizado para este vídeo.', 403);
  }
  // assinatura válida e domínio permitido: deixa o player.html ser servido normalmente
}

// Se o vídeo tiver uma lista de domínios permitidos (separados por vírgula,
// já validada pela assinatura acima), só deixa passar quando o Referer do
// embed bate com um deles. O preview dentro do próprio dashboard (mesmo host
// da request) é sempre permitido, senão você não conseguiria nem visualizar
// o próprio vídeo enquanto edita.
function isDomainAllowed(request, domainsParam) {
  if (!domainsParam) return true; // sem restrição configurada para este vídeo

  const allowed = domainsParam.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (allowed.length === 0) return true;

  const selfHost = (request.headers.get('host') || '').toLowerCase();
  const referer = request.headers.get('referer');
  if (!referer) return false; // restrição ativa exige Referer (embed via iframe)

  let refHost;
  try { refHost = new URL(referer).host.toLowerCase(); } catch (e) { return false; }

  if (selfHost && refHost === selfHost) return true; // preview dentro do próprio dashboard

  return allowed.includes(refHost);
}
