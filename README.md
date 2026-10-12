# VSL Player

Clone simplificado de um player de VSL (estilo VTurb), feito em HTML + CSS + JS puro, sem frameworks e sem backend. Tudo é salvo no `localStorage` do navegador.

## Arquivos

- **`index.html`** — Dashboard de gerenciamento (upload, edição, embed, analytics).
- **`player.html`** — Player de vídeo embedável, configurado via parâmetros de URL.
- **`middleware.js`**, **`api/sign-embed.js`**, **`lib/hmac.js`**, **`vercel.json`** — proteção usada no deploy (Basic Auth do dashboard, assinatura HMAC dos links de embed, cabeçalhos de segurança). Ver [Deploy na Vercel](#deploy-na-vercel).

## Como rodar

Os dois arquivos precisam ser servidos por um servidor HTTP local (não abrir com `file://`), porque:
- vídeos enviados por upload usam `blob:` URLs, que exigem o mesmo `origin`;
- o preview do player roda dentro de um `<iframe>`, o que alguns navegadores restringem em `file://`.

Na pasta do projeto, rode:

```bash
python3 -m http.server 8934
```

E abra:

```
http://localhost:8934/index.html
```

## Dashboard (`index.html`)

### Meus Vídeos
- **+ Novo vídeo**: abre um modal para enviar um vídeo por **drag & drop**/seleção de arquivo (gera uma `blob:` URL) ou colando uma **URL direta** (`https://...`) ou uma **blob URL** já existente.
- Ao adicionar, uma miniatura é gerada automaticamente a partir de um frame do vídeo (com fallback para uma miniatura genérica se não for possível capturar).
- Tabs:
  - **Biblioteca** — todos os vídeos ativos.
  - **Top vídeos** — ordenados por número de plays.
  - **Lixeira** — vídeos excluídos, com opção de restaurar ou excluir permanentemente.
- Ações por vídeo: **Analytics** (estatísticas simuladas), **Embed** (gera o código de incorporação) e **Excluir** (move para a lixeira).
- Clicar no nome ou na miniatura abre a página de edição do vídeo.

### Edição do vídeo
Painéis de configuração à esquerda (tudo salvo automaticamente no `localStorage`):

| Painel | O que controla |
|---|---|
| Estilo | cor principal, cor de fundo, cantos arredondados, quais controles do player ficam visíveis (play grande/pequeno, desativar pausa, barra de progresso, tempo, voltar/avançar 10s, volume, tela cheia, velocidade) |
| Progresso Inteligente | cor e altura da barra de progresso |
| Smart Autoplay | liga/desliga autoplay mudo, texto do overlay "toque para ativar o som", trecho inicial (segundos de prévia muda antes de pausar sozinho) |
| Botões de Ação | texto, subtexto, link de checkout, tempo (em segundos) para o CTA aparecer, cor |
| Continuar Assistindo | mensagem e textos dos botões continuar/reiniciar; salva o progresso no `localStorage` do navegador e oferece retomar/recomeçar ao reabrir o player |
| Pixels | ID do Meta Pixel e porcentagens de disparo; carrega o `fbevents.js` real e dispara `PageView` + `VideoProgress` nas porcentagens configuradas |
| Opções de Reprodução | smart pause (pausa/retoma sozinho ao sair da tela ou trocar de aba), recomeçar ao terminar, velocidade, fullscreen (desktop/mobile), Picture-in-Picture |

À direita fica o **preview ao vivo** do `player.html` dentro de um iframe, com toggle **Desktop / Mobile**.

> Todos os painéis acima afetam o `player.html` de verdade: a configuração inteira do vídeo viaja para o player num único parâmetro `cfg` (JSON em base64url) — veja a tabela de parâmetros abaixo.

### Embed
No botão **Embed** (no topo da edição ou na tabela de vídeos):
- Toggle **Vídeo Responsivo** (usa a técnica de `padding-bottom` para manter proporção 16:9 fluida).
- Tabs de código: **Recomendado** (div + script que injeta um iframe), **JavaScript** (snippet que se insere via `document.currentScript`) e **iFrame** (tag `<iframe>` pura).
- **Link direto** para o player e um **preview** do resultado.
- Botão para copiar o código/link.

### Segurança e Configurações
- **Marca d'água** e **whitelist de domínio** (Segurança) são reais: a marca d'água é sobreposta no vídeo em todo player embedado, e a whitelist é unida (não substitui) com a lista de domínios específica de cada vídeo, validada pelo `middleware.js` do mesmo jeito.
- **Senha para assistir** (Segurança) é só ilustrativa por decisão de produto — o controle de acesso real do player é a restrição de domínio já existente, não uma senha client-side.
- Cor padrão do player, uso de armazenamento local e limpar todos os dados já são reais (usados na criação de novos vídeos e na limpeza do `localStorage`).

## Player (`player.html`)

Parâmetros de URL aceitos:

| Parâmetro | Descrição | Padrão |
|---|---|---|
| `v` | URL do vídeo (`https://...` ou `blob:...`) | — |
| `poster` | Imagem de capa (URL ou `data:` URI) | — |
| `id` / `kv` | Identificam o vídeo e a versão da chave de assinatura (ver [Links de embed assinados](#links-de-embed-assinados-evita-que-terceiros-usem-seus-vídeos)) | — |
| `domains` | Lista de domínios permitidos (por vídeo + whitelist global da Segurança), separada por vírgula | — |
| `cfg` | Todo o resto da configuração do vídeo (Estilo, Progresso, Autoplay, Botão de Ação, Continuar Assistindo, Pixels, Reprodução) + marca d'água, como JSON em base64url | — |
| `sig` | Assinatura HMAC do restante dos parâmetros (ver seção de segurança) | — |

O dashboard nunca monta `cfg` na mão — é sempre gerado pelo modal de Embed a partir da configuração atual do vídeo, então não há necessidade de montar esse JSON manualmente.

Comportamento:
- Autoplay mudo (se ativado); clique na tela desmuta e/ou dá play/pause; "trecho inicial" pausa sozinho após N segundos se o usuário ainda não interagiu.
- Barra de progresso própria (clicável e arrastável), com cor/altura configuráveis; nova barra de controles (play/pausa, voltar/avançar 10s, tempo, volume, velocidade, PiP, tela cheia) conforme os toggles de Estilo.
- Botão de CTA aparece no tempo configurado e abre o link em nova aba.
- Continuar Assistindo guarda o progresso no `localStorage` (por `id` do vídeo) e oferece retomar/recomeçar ao reabrir.
- Pixels carrega o Meta Pixel real (`fbevents.js`) e dispara eventos nas porcentagens configuradas.
- Smart pause, recomeçar ao terminar, velocidade e fullscreen/PiP seguem as Opções de Reprodução configuradas.
- Teclado: `Espaço` play/pause (respeita "desativar pausa"), `←`/`→` voltar/avançar 10s.

## Deploy na Vercel

O projeto já vem com o que é necessário para um deploy razoavelmente seguro, sem precisar de build nem de banco de dados:

- **`vercel.json`** — cabeçalhos de segurança:
  - `/` e `/index.html` (dashboard): `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN` (evita que o dashboard seja carregado dentro de um iframe de outro site — clickjacking), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` restritiva.
  - `/player.html`: os mesmos cabeçalhos de higiene, mas **sem** restrição de `frame-ancestors`/`X-Frame-Options`, porque o player precisa continuar embutível em qualquer página de venda de terceiros — essa é a função dele.
- **`middleware.js`** — Edge Middleware com duas responsabilidades:
  - Exige **HTTP Basic Auth** para acessar `/`, `/index.html` e `/api/sign-embed`.
  - Aplica a **restrição de domínio** de toda requisição a `/player.html`. A validação da assinatura HMAC (`sig`) **foi removida** — ver a nota na seção abaixo.
- **`api/sign-embed.js`** — função serverless (Edge Function) que assina os parâmetros de um vídeo com `PLAYER_SIGNING_SECRET`, usada pelo dashboard para gerar links de embed.
- **`lib/hmac.js`** — funções de assinatura/verificação HMAC-SHA256 compartilhadas entre o middleware e a função de assinatura.

`player.html` continua público de propósito (sem Basic Auth) — ele precisa ser acessível de qualquer página de venda que o incorpore. O que o protege contra uso indevido por terceiros é a restrição de domínio, explicada abaixo.

### Links de embed assinados (evita que terceiros usem seus vídeos)

> **Desativado:** a verificação do `sig` no `middleware.js` foi removida. O dashboard e `/api/sign-embed` continuam gerando links assinados, mas **nenhuma requisição a `/player.html` é mais rejeitada por assinatura inválida, ausente ou revogada** — qualquer link para o player carrega. Consequências: a revogação de links antigos (seção seguinte) deixou de ter efeito, e a lista de domínios virou um parâmetro comum da URL, editável por quem tiver o link. O resto desta seção descreve como o mecanismo funcionava, e volta a valer se a validação for reativada.

Sem essa proteção, qualquer pessoa poderia montar na mão uma URL `player.html?v=...` apontando para a URL de vídeo de outra pessoa, ou copiar um link de embed seu e trocar o link de checkout do botão de ação (dentro do `cfg`) para outro destino. Para evitar isso:

1. Você define `PLAYER_SIGNING_SECRET` (uma string aleatória) como variável de ambiente do projeto na Vercel — **só ela** conhece esse segredo mestre.
2. Sempre que o dashboard gera ou atualiza um link de player (preview da edição, modal de Embed), ele chama `/api/sign-embed` — que já está atrás do Basic Auth — mandando os parâmetros do vídeo, incluindo `id` (id do vídeo) e `kv` (versão da chave dele, ver abaixo). Essa função deriva uma **chave específica daquele vídeo** (`HMAC(PLAYER_SIGNING_SECRET, id + ':' + kv)`) e assina os parâmetros com ela: `sig = HMAC(chave_do_vídeo, parâmetros)`. Nem o segredo mestre nem a chave derivada saem do servidor — só o `sig` (resultado) viaja na URL.
3. O link gerado carrega esse `sig` (e o `id`/`kv` usados para derivá-lo) como parâmetros: `player.html?v=...&id=...&kv=1&sig=...`.
4. ~~Toda vez que `/player.html` é acessado (por qualquer pessoa, em qualquer site), o middleware repete o mesmo cálculo a partir dos parâmetros da própria URL e compara com o `sig` recebido. Se qualquer parâmetro foi alterado (vídeo trocado, `cfg` adulterado — incluindo o link de checkout do botão de ação —, link forjado para um `id` que não é seu) ou o `sig` não bater, a resposta é `403` e o player não carrega.~~ *(etapa removida do middleware.)*

Por que HMAC (segredo compartilhado) em vez de par de chaves assimétrico: quem assina (a função `/api/sign-embed`) e quem valida (o middleware) são o mesmo lado de confiança — você. Um par de chaves público/privada faz sentido quando assinante e verificador são partes diferentes; aqui só adicionaria complexidade sem ganho de segurança.

**Esse recurso é opcional e "fail-open":** se `PLAYER_SIGNING_SECRET` não estiver configurada, `/api/sign-embed` devolve link sem assinatura. Hoje isso é indiferente para o player, já que o middleware não valida mais o `sig` — a restrição de domínio abaixo é aplicada em qualquer caso. Nada disso roda ao testar localmente com um servidor estático simples, que não executa `middleware.js` nem `api/sign-embed.js`.

> **Importante:** um `sig` válido é o que efetivamente entrega o vídeo pro navegador de quem assiste — isso é inevitável em qualquer link assinado (o mesmo vale pra URLs assinadas da AWS/CloudFront, tokens JWT, etc). Ou seja, essa assinatura impede **forjar ou adulterar** um link, mas **não impede que um link legítimo, copiado inteiro (com `sig` e tudo), continue funcionando em outro lugar**. As duas seções abaixo (chave por vídeo + revogação, e restrição de domínio) são o que endereça especificamente esse segundo problema.

> **Testando localmente com a assinatura ativa**: `python -m http.server` (usado no início deste README) não executa Edge Middleware nem funções serverless — ele serve os arquivos estáticos e ignora `middleware.js`/`api/`. Para testar a validação de assinatura antes de publicar, rode `vercel dev` na pasta do projeto (com `BASIC_AUTH_USER`, `BASIC_AUTH_PASS` e `PLAYER_SIGNING_SECRET` definidos em um arquivo `.env.local` ou no ambiente) — assim o comportamento local fica idêntico ao de produção.

### Chave por vídeo e revogação de embeds

> **Sem efeito hoje:** com a validação de assinatura removida do middleware, o botão de revogar incrementa a versão da chave do vídeo mas não invalida nenhum link já publicado.

Cada vídeo tem sua própria chave derivada (a partir do segredo mestre + o `id` do vídeo + uma "versão da chave" que começa em `1`), não uma chave só pra tudo. Na prática isso te dá um botão de **"Revogar links antigos"** no modal de Embed: ele incrementa a versão da chave daquele vídeo específico e gera um novo link. Todo embed publicado antes disso (que usa a versão anterior) passa a ser rejeitado pelo middleware — **só para aquele vídeo**, os outros continuam intactos. Use isso se descobrir que um embed vazou/foi usado onde não devia e quer invalidá-lo sem precisar trocar o segredo mestre (o que quebraria todos os vídeos de uma vez).

### Restrição por domínio

No modal de Embed, o campo **"Domínios permitidos"** deixa você listar (um por linha) em quais domínios aquele vídeo pode ser exibido — por exemplo, a página de vendas onde ele está publicado. A página global de **Segurança** também tem uma whitelist de domínio, que quando ligada é **somada** (não substitui) à lista específica de cada vídeo — as duas viram o mesmo parâmetro `domains`. Como a assinatura não é mais validada, esse parâmetro pode ser editado na URL por quem tiver o link — a restrição continua valendo para o embed publicado, mas não é mais à prova de adulteração. Quando configurado:

- O middleware verifica o cabeçalho `Referer` de quem carregou `/player.html` e só deixa passar se o domínio bater com um da lista (ou vier do próprio dashboard, pra não travar o seu preview enquanto edita).
- Deixe o campo vazio para não restringir (qualquer domínio pode embutir o vídeo).

**Limitações a ter em mente:**
- Isso depende do navegador enviar o `Referer` do embed. Se a página onde o vídeo está publicado (ou uma ferramenta de landing page/CMS que ela usa) desativa o envio de referrer — por política própria (`Referrer-Policy: no-referrer`) ou no próprio `<iframe referrerpolicy="no-referrer">` — o player vai bloquear mesmo sendo o domínio certo. Se isso acontecer no seu caso, ajuste essa política na página de origem ou deixe o campo de domínios vazio para esse vídeo.
- Acesso direto ao link (colado na barra de endereço, sem vir de um `<iframe>`) não tem `Referer` e por isso é bloqueado quando a restrição está ativa — comportamento esperado, igual à maioria dos esquemas de proteção contra hotlink.
- Isso não impede que alguém com acesso ao próprio domínio permitido baixe o vídeo pela aba de rede do navegador; protege contra reuso *do embed* em outro site, não contra cópia do arquivo de vídeo em si.

### Passos para publicar

1. Suba o projeto para um repositório Git (GitHub/GitLab/Bitbucket) e importe-o na Vercel, ou rode `vercel` pela CLI a partir desta pasta.
2. Em **Project Settings → Environment Variables**, crie:
   - `BASIC_AUTH_USER`
   - `BASIC_AUTH_PASS`
   - `PLAYER_SIGNING_SECRET` (opcional — uma string aleatória longa, ex: gerada com `openssl rand -base64 32`; hoje só afeta a geração do `sig` nos links, que não é mais verificado)
3. Faça o deploy (ou redeploy, se essas variáveis foram criadas depois do primeiro deploy).

Sem `BASIC_AUTH_USER`/`BASIC_AUTH_PASS` configuradas, o middleware **bloqueia** o acesso ao dashboard (retorna erro 500 pedindo para configurá-las) em vez de deixar tudo aberto por padrão. `PLAYER_SIGNING_SECRET` só é usada por `/api/sign-embed` para assinar os links gerados — com a validação removida do middleware, links com `sig` antigo, inválido ou sem `sig` nenhum funcionam igual.

### O que essa proteção cobre (e o que não cobre)

- **Cobre**: acesso casual/indexação por buscadores ao painel de gerenciamento (Basic Auth); reuso de um embed publicado fora dos domínios que você autorizou para aquele vídeo (restrição de domínio).
- **Não cobre mais**: terceiros forjando links para os seus vídeos ou adulterando parâmetros de um link copiado — incluindo o `domains` e o link de checkout dentro do `cfg` —, nem revogação de embeds que vazaram, já que a validação da assinatura HMAC foi removida do middleware.
- **Não é autenticação robusta**: Basic Auth é simples, sem sessões, sem múltiplos usuários, sem expiração — suficiente para uso pessoal/pequenas equipes, mas não para um produto multiusuário real. Para algo mais forte, veja a opção nativa da Vercel de **Deployment/Password Protection** (Project Settings → Deployment Protection, recurso do plano Pro), que pode ser usada em conjunto ou no lugar do middleware.
- **Links não expiram**: um embed continua válido indefinidamente; com a assinatura desativada, nem a revogação manual o invalida.
- **Restrição de domínio depende do `Referer`**: veja as limitações detalhadas na seção acima — páginas/ferramentas que suprimem o envio de `Referer` podem bloquear até o domínio legítimo.
- **A aba "Segurança" do dashboard é só um placeholder de UI** (whitelist de domínio, senha, marca d'água) — não tem relação com a proteção de embed descrita aqui, que é configurada por vídeo no modal de Embed.
- **Não protege dados**: como a aplicação não tem backend, tudo (vídeos, configs) fica no `localStorage` do navegador de quem está usando o dashboard — não há dado compartilhado entre pessoas diferentes nem entre dispositivos.
- **CSP usa `'unsafe-inline'`** em `script-src`/`style-src` porque todo o código é inline nos dois arquivos (por design, sem build). Isso reduz um pouco a proteção da CSP contra XSS; os campos que exibem dados do usuário no dashboard (nome do vídeo, etc.) já são escapados antes de ir para o HTML, e a URL do botão de ação no player é validada para aceitar apenas `http:`/`https:` (bloqueando URLs `javascript:` maliciosas).

## Limitações conhecidas

- Vídeos enviados por **upload de arquivo** usam `blob:` URLs, válidas apenas enquanto a aba do `index.html` que os criou permanece aberta. O preview e o modal de embed dentro do próprio dashboard funcionam normalmente, mas abrir o link direto do embed em outra aba/janela isolada não vai carregar o vídeo. Vídeos adicionados por **URL direta** não têm essa limitação. Em um cenário real, o upload subiria o arquivo para um storage/CDN.
- Não há backend: todos os dados (vídeos, configs, segurança, configurações) ficam apenas no `localStorage` do navegador usado.
