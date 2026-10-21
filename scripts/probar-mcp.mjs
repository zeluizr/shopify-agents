#!/usr/bin/env node
// Arranca el servidor MCP tal como lo declara plugins/shopify-agents/.mcp.json, le pide la
// lista de herramientas por stdio, con el mismo env y comprueba que cada herramienta MCP que usa un agente
// exista de verdad en el servidor. Sin dependencias: JSON-RPC a mano, un mensaje por línea.
//
//   node scripts/probar-mcp.mjs
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname;
const pluginDir = join(raiz, "plugins/shopify-agents");
const nombrePlugin = "shopify-agents";
const nombreServidor = "shopify-dev";
const prefijo = `mcp__plugin_${nombrePlugin}_${nombreServidor}__`;

const mcp = JSON.parse(readFileSync(join(pluginDir, ".mcp.json"), "utf8"));
const servidor = mcp.mcpServers?.[nombreServidor];
if (!servidor) {
	console.error(`.mcp.json no declara el servidor ${nombreServidor}`);
	process.exit(1);
}

// Herramientas MCP que los agentes declaran en su frontmatter.
const usadas = new Set();
for (const archivo of readdirSync(join(pluginDir, "agents")).filter((f) => f.endsWith(".md"))) {
	const s = readFileSync(join(pluginDir, "agents", archivo), "utf8");
	const linea = s.match(/^tools:\s*(.*)$/m)?.[1] ?? "";
	for (const t of linea.split(",").map((x) => x.trim())) {
		if (t.startsWith(prefijo)) usadas.add(t.slice(prefijo.length));
	}
}

const proceso = spawn(servidor.command, servidor.args ?? [], {
	stdio: ["pipe", "pipe", "inherit"],
	env: { ...process.env, ...(servidor.env ?? {}) }
});
let id = 0;
const pendientes = new Map();
let resto = "";
proceso.stdout.on("data", (trozo) => {
	resto += trozo.toString();
	let i;
	while ((i = resto.indexOf("\n")) >= 0) {
		const linea = resto.slice(0, i).trim();
		resto = resto.slice(i + 1);
		if (!linea) continue;
		let msg;
		try {
			msg = JSON.parse(linea);
		} catch {
			continue;
		}
		if (msg.id !== undefined && pendientes.has(msg.id)) {
			const { resolver, rechazar } = pendientes.get(msg.id);
			pendientes.delete(msg.id);
			msg.error ? rechazar(new Error(JSON.stringify(msg.error))) : resolver(msg.result);
		}
	}
});

const enviar = (m) => proceso.stdin.write(JSON.stringify(m) + "\n");
const pedir = (method, params = {}) =>
	new Promise((resolver, rechazar) => {
		const propio = ++id;
		pendientes.set(propio, { resolver, rechazar });
		enviar({ jsonrpc: "2.0", id: propio, method, params });
	});

const limite = setTimeout(() => {
	console.error("el servidor MCP no respondió en 120 segundos");
	proceso.kill();
	process.exit(1);
}, 120_000);

try {
	const init = await pedir("initialize", {
		protocolVersion: "2025-06-18",
		capabilities: {},
		clientInfo: { name: "shopify-agents/probar-mcp", version: "0" }
	});
	enviar({ jsonrpc: "2.0", method: "notifications/initialized" });
	const { tools } = await pedir("tools/list");
	const nombres = new Set(tools.map((t) => t.name));
	console.log(`${init.serverInfo?.name} ${init.serverInfo?.version}: ${tools.length} herramientas`);
	for (const n of [...nombres].sort()) console.log(`  ${usadas.has(n) ? "•" : " "} ${n}`);

	const faltan = [...usadas].filter((u) => !nombres.has(u));
	if (faltan.length) {
		console.error(`\nherramientas usadas por los agentes que el servidor no expone: ${faltan.join(", ")}`);
		process.exitCode = 1;
	} else {
		console.log(`\n✓ las ${usadas.size} herramientas que usan los agentes existen en el servidor`);
	}
} catch (e) {
	console.error(e.message);
	process.exitCode = 1;
} finally {
	clearTimeout(limite);
	proceso.kill();
}
