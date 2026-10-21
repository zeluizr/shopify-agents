# Changelog

Todos los cambios de shopify-agents. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
las versiones siguen [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Agregado

- Cinco subagentes read-only: `shopify-explorer`, `shopify-reviewer`, `shopify-qa`, `shopify-integration-architect` y
  `shopify-docs-researcher`.
- El plugin trae el servidor MCP `shopify-dev` ([@shopify/dev-mcp](https://www.npmjs.com/package/@shopify/dev-mcp)),
  ejecutado con `npx -y @shopify/dev-mcp` y `OPT_OUT_INSTRUMENTATION=true`: búsqueda en shopify.dev y validación de
  GraphQL, componentes de extensiones, Functions y Liquid.
- Los agentes precargan la skill oficial `shopify` del Shopify AI Toolkit, salvo `shopify-docs-researcher`, que
  arranca vacío a propósito. Ninguno corre los scripts de la skill ni envía `user_prompt` al servidor.
- Gate del repositorio (`scripts/verificar.sh`): JSON válido, misma versión en los tres manifiestos, configuración del
  servidor MCP con la telemetría apagada, frontmatter de los agentes (nombre, description, `Skill` presente, sin
  `Write` ni `Edit`, máximo cuatro skills precargadas, prefijo MCP propio, skills existentes en el Shopify AI Toolkit),
  `claude plugin validate --strict`, Prettier, `bash -n` y búsqueda de rastros que no deben llegar a un repositorio
  público.
- `scripts/probar-mcp.mjs`: arranca el servidor MCP por stdio y comprueba que cada herramienta que usa un agente exista.
- CI en GitHub Actions con el gate, la prueba del servidor MCP, gitleaks y el control del flujo `dev → qa → main`.
