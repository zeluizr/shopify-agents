# shopify-agents

**Cinco subagentes de Claude Code para Shopify y Shopify Plus y el servidor MCP oficial `@shopify/dev-mcp`, en un solo
plugin. Los agentes exploran, revisan, verifican, diseñan integraciones y buscan documentación; el servidor les da la
documentación de shopify.dev, los esquemas GraphQL y la validación de Liquid sin salir del editor.**

Construido sobre la skill oficial `shopify` del [Shopify AI Toolkit](https://github.com/Shopify/Shopify-AI-Toolkit).
Gratis y de código abierto. El toolkit trae el conocimiento; este plugin agrega lo que el toolkit no tiene: subagentes
read-only que se quedan con el ruido y devuelven solo la señal.

[![licencia](https://badgen.net/github/license/zeluizr/shopify-agents?color=142032)](./LICENSE)
[![último commit](https://badgen.net/github/last-commit/zeluizr/shopify-agents)](https://github.com/zeluizr/shopify-agents/commits)
[![estrellas](https://badgen.net/github/stars/zeluizr/shopify-agents)](https://github.com/zeluizr/shopify-agents/stargazers)

Versión 0.1.0, según `.claude-plugin/marketplace.json`.

---

## Qué incluye

| Agente                          | Qué hace                                                                                                  | Skills que precarga  | Herramientas del servidor MCP                                           | Modelo    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------- | --------- |
| `shopify-explorer`              | Mapea un tema, una app o un storefront Hydrogen: sections, blocks, extensiones, scopes, webhooks.         | `shopify`            | `learn_shopify_api`, `search_docs_chunks`                               | haiku     |
| `shopify-reviewer`              | Revisa el diff antes del deploy: secretos, HMAC, scopes, costo de las consultas, contrato de los schemas. | `shopify`            | `learn_shopify_api`, `search_docs_chunks`, `validate`, `validate_theme` | `inherit` |
| `shopify-qa`                    | Corre Theme Check, build, lint y tests, y devuelve solo las fallas con archivo y stack.                   | `shopify`            | ninguna, a propósito                                                    | sonnet    |
| `shopify-integration-architect` | Diseña y audita integraciones con ERP, OMS y marketplaces, incluido Plus (Functions, B2B, Markets).       | `shopify`            | `learn_shopify_api`, `search_docs_chunks`                               | opus      |
| `shopify-docs-researcher`       | Busca en la documentación de Shopify y cita siempre la fuente.                                            | ninguna, a propósito | `learn_shopify_api`, `search_docs_chunks`                               | haiku     |

El servidor MCP es [`@shopify/dev-mcp`](https://www.npmjs.com/package/@shopify/dev-mcp), el oficial de Shopify,
ejecutado con `npx -y @shopify/dev-mcp` y con `OPT_OUT_INSTRUMENTATION=true`. No pide credenciales ni toca ninguna
tienda: busca en shopify.dev y valida GraphQL, componentes de extensiones, Functions y Liquid contra los esquemas
reales. Su herramienta `feedback` queda fuera de todos los agentes, porque solo sirve para reportarle a Shopify.

Ningún agente tiene `Write` o `Edit`, y ninguno envía el campo `user_prompt` al servidor. El razonamiento detrás de
cada decisión está en [docs/agentes.md](docs/agentes.md).

## Cómo funciona

1. **La `description`** de cada agente es lo que Claude lee para decidir a quién delegar. Están escritas para que la
   delegación ocurra sola: "úsalo proactivamente antes de cualquier cambio estructural", "úsalo antes de
   `shopify app deploy`".
2. **La skill `shopify`** entra completa al contexto del agente al arrancar: es la tabla de temas del toolkit oficial
   (Admin, Liquid, Functions, Hydrogen, checkout, Polaris, CLI…). Cada agente lee bajo demanda solo el archivo de
   `references/` del tema que necesita.
3. **El servidor MCP** arranca con el plugin. Cada agente declara nombre por nombre las herramientas que usa, con el
   prefijo `mcp__plugin_shopify-agents_shopify-dev__`, y llama primero a `learn_shopify_api`, que el servidor exige
   antes de las demás. Si el servidor no está en la sesión, el agente sigue con lo que tiene y lo dice.

## Privacidad

Las skills y el servidor del toolkit envían telemetría a Shopify por defecto: consultas, código validado y, si el
agente lo entrega, el mensaje literal de quien pregunta. Este plugin la apaga en el servidor MCP con
`OPT_OUT_INSTRUMENTATION=true`, les prohíbe a los agentes correr los scripts de la skill (que reportan aparte) y les
prohíbe enviar `user_prompt`.

Para apagarla también en la conversación principal, donde la skill sí corre sus scripts, crea el archivo vacío que el
toolkit reconoce en cualquier proceso:

```bash
mkdir -p ~/.config/shopify-ai-toolkit && touch ~/.config/shopify-ai-toolkit/opt-out
```

## Requisitos

- Claude Code con soporte de plugins.
- Node `>= 18`, para que `npx` ejecute el servidor MCP y los scripts de la skill.
- La skill oficial `shopify`, instalada con `npx skills add Shopify/Shopify-AI-Toolkit`. Sin ella los agentes
  funcionan, pero degradados: Claude Code omite las skills que no encuentra y conserva el flujo de cada agente, sin la
  tabla de temas ni las referencias que hacen precisas sus respuestas. Si la instalas como plugin
  (`shopify-ai-toolkit@claude-plugins-official`), Claude Code la registra con el nombre del plugin delante; los agentes
  la siguen encontrando con el tool `Skill`, pero no como skill precargada.
- El [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) para que `shopify-qa` corra Theme Check y
  `shopify app build`.

## Instalación

```bash
/plugin marketplace add zeluizr/shopify-agents
/plugin install shopify-agents@shopify-agents
```

Reinicia Claude Code o corre `/reload-plugins`. Los agentes aparecen en el typeahead de `@` como
`shopify-agents:shopify-reviewer`, y el servidor MCP como `shopify-dev`.

Si ya tenías `@shopify/dev-mcp` agregado con `claude mcp add`, quítalo con `claude mcp remove <nombre>` para no tener
el servidor dos veces.

## Uso

**Por mención.**

```
@shopify-agents:shopify-reviewer revisa lo que acabo de cambiar en sections/ y en extensions/
```

**Por lenguaje natural.** No hace falta nombrarlos.

```
antes de hacer el deploy, corre Theme Check y revisa el diff
```

**Por sesión completa.**

```bash
claude --agent shopify-agents:shopify-integration-architect
```

**El servidor MCP, directo.** "¿Qué campos tiene `ProductVariant` en `2026-10`?", "valida esta mutación de
`inventorySetQuantities`", "busca cómo se declara un app block en una theme app extension".

## Actualizar y desinstalar

| Acción      | Comando                                           |
| ----------- | ------------------------------------------------- |
| Actualizar  | `/plugin marketplace update shopify-agents`       |
| Desinstalar | `/plugin uninstall shopify-agents@shopify-agents` |

## Estructura

```
.claude-plugin/marketplace.json       catálogo del marketplace de Claude Code
plugins/shopify-agents/
	.claude-plugin/plugin.json          manifiesto del plugin; mcpServers apunta a .mcp.json
	.mcp.json                           el servidor MCP shopify-dev: npx -y @shopify/dev-mcp, sin telemetría
	agents/                             los cinco agentes, uno por archivo
docs/agentes.md                       por qué cada agente es como es
scripts/verificar.sh                  gate de este repositorio
scripts/probar-mcp.mjs                arranca el servidor MCP y comprueba las herramientas que usan los agentes
```

## Desarrollo

Para desarrollar este repositorio se requiere **Node >= 20**, según [package.json](package.json). El requisito de
Node >= 18 indicado arriba corresponde a ejecutar el servidor MCP. Las definiciones de los cinco agentes viven en
[plugins/shopify-agents/agents/](plugins/shopify-agents/agents/) y su conexión MCP en
[.mcp.json](plugins/shopify-agents/.mcp.json).

```bash
git clone https://github.com/zeluizr/shopify-agents.git
cd shopify-agents
npm ci
./scripts/verificar.sh
node scripts/probar-mcp.mjs
```

`scripts/verificar.sh` es el gate, el mismo que corre el CI: JSON válido, la misma versión en los tres manifiestos,
la configuración del servidor MCP (incluida la telemetría apagada), el frontmatter de cada agente (nombre igual al
archivo, `description`, tool `Skill` presente, sin `Write` ni `Edit`, máximo cuatro skills precargadas, prefijo MCP
propio y skills que existen en el Shopify AI Toolkit), `claude plugin validate --strict`, Prettier, `bash -n` y una
búsqueda de rastros que no deben llegar a un repositorio público. `scripts/probar-mcp.mjs` arranca el servidor por
stdio y falla si una herramienta que un agente declara no existe. El CI suma la búsqueda de secretos con gitleaks y el
control del flujo de ramas.

Para probar el plugin sin publicarlo:

```bash
claude --plugin-dir ./plugins/shopify-agents
```

La versión vive en tres lugares: arriba en `.claude-plugin/marketplace.json`, en la entrada del plugin del mismo
archivo y en `plugins/shopify-agents/.claude-plugin/plugin.json`. Se sube en los tres a la vez; sin subirla, Claude
Code no entrega el cambio a quien ya tiene el plugin.

## Contribuir

Conventional Commits. Las ramas salen de `dev` y el pull request va contra `dev`, nunca contra `qa` ni contra `main`;
la promoción es merge de la rama entera. Un agente nuevo tiene que pasar la pregunta de
[docs/agentes.md](docs/agentes.md#por-qué-no-hay-más-agentes): ¿genera ruido intermedio que la conversación principal
no necesita ver? Si no, no hace falta.

## Licencia

[MIT](./LICENSE)

_Hecho con amor y café por [zeluizr](https://github.com/zeluizr) y con la ayuda de [Claude](https://claude.ai/referral/Cz_UimA0NQ) ☕_
