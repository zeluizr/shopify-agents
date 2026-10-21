# Los cinco agentes y el servidor MCP, y por qué son así

Este documento explica las decisiones de diseño detrás de cada agente del paquete. No es documentación de uso, para eso está el [README](../README.md). Es el razonamiento: por qué cada agente corre en el modelo que corre, por qué carga la skill que carga, y por qué todos son read-only.

## Los principios que aplican a los cinco

Antes de entrar agente por agente, siete decisiones que atraviesan todo el paquete.

### Un subagente vale por lo que no devuelve

Un subagente corre en su propia ventana de contexto y devuelve a la conversación principal solo su respuesta final. Todo lo que leyó, todo lo que grepeó, toda la salida de los comandos que ejecutó se queda en su contexto y se descarta.

Esa es la única razón por la que un subagente vale su costo. Si una tarea no genera ruido intermedio, delegarla es más caro que hacerla en la conversación principal, porque pagas el arranque en frío de un agente que no sabe nada de lo que ya conversaron. Los cinco agentes de este paquete existen porque su trabajo produce mucho material intermedio que nadie necesita volver a leer: árboles de un tema con cientos de sections y snippets, diffs completos, reportes de Theme Check, páginas de shopify.dev.

Por eso cada uno tiene una regla explícita de formato de salida, y por eso `shopify-qa` es el caso más extremo del paquete: corre comandos que escupen cientos de líneas y devuelve una sola cuando todo pasa.

### Complemento del toolkit oficial, no reemplazo

Shopify publica el [Shopify AI Toolkit](https://github.com/Shopify/Shopify-AI-Toolkit): una skill, `shopify`, que cubre todas las superficies de la plataforma con una tabla de temas y un archivo de referencia por tema, más el servidor MCP `@shopify/dev-mcp`. Es conocimiento, y es bueno. Lo que no trae es división del trabajo: no tiene subagentes.

Este paquete no reescribe ese conocimiento. Lo consume, y agrega encima la parte que el toolkit no tiene: cinco especialidades con modelo, herramientas y formato de salida propios, y la regla de que ninguna escribe.

### Una sola skill, y el cupo de cuatro sigue

El campo `skills` del frontmatter inyecta el contenido completo de cada skill en el contexto del subagente al arrancar, no solo su descripción. El toolkit tuvo una veintena de skills separadas y las fundió en una sola, `shopify`, cuyo cuerpo es corto: una tabla que dice qué tema corresponde a cada pedido y dónde está su referencia. El detalle vive en `references/<tema>.md` y se lee bajo demanda.

Eso cambia la economía respecto de un paquete con muchas skills pequeñas. Precargar `shopify` es barato y le da al agente el mapa entero; leer una referencia es una decisión que el agente toma cuando el caso la pide. Por eso cuatro de los cinco agentes precargan la misma skill, y por eso los prompts nombran qué referencias consultar en lugar de qué skills precargar.

El gate conserva el límite de cuatro skills precargadas por agente. Hoy sobra, y está ahí para el día en que alguien quiera sumar una skill propia del equipo.

### Read-only por defecto

Ninguno de los cinco tiene `Write` ni `Edit`. Dos de ellos tienen `Bash`, y sus instrucciones acotan explícitamente para qué.

No es paranoia, es división del trabajo. Un agente que puede escribir se convierte en un desarrollador paralelo que no ve la conversación completa, y sus cambios llegan a la conversación principal como un hecho consumado que hay que revisar. Un agente que solo lee devuelve información, y la decisión de qué hacer con esa información se queda donde está el contexto acumulado.

En Shopify hay una razón más: el CLI está a un comando de una tienda real. `shopify theme push`, `shopify app deploy` y `shopify store execute` cambian lo que ven los compradores. Los dos agentes con `Bash` tienen la lista de comandos prohibidos escrita en su prompt.

### El servidor MCP es fuente, no cerebro

El plugin trae el servidor MCP `shopify-dev`, que es [`@shopify/dev-mcp`](https://www.npmjs.com/package/@shopify/dev-mcp) ejecutado con `npx -y @shopify/dev-mcp`. No pide credenciales ni toca ninguna tienda. Expone cinco herramientas: `learn_shopify_api`, `search_docs_chunks`, `validate`, `validate_theme` y `feedback`.

La decisión es qué agente recibe qué herramienta, y la regla fue la misma que para las skills: cada agente recibe solo las herramientas que su caso típico necesita. `validate` y `validate_theme` son solo del revisor, porque son las que convierten una opinión en un hallazgo. `feedback` no la recibe nadie: sirve para calificar el toolkit ante Shopify, no para responder la pregunta de quien invocó al agente.

`learn_shopify_api` merece una nota. El servidor la exige antes de cualquier otra herramienta: devuelve un `conversationId` sin el cual las demás fallan, y hay que volver a llamarla cada vez que la conversación cambia de superficie (de Admin a Functions, por ejemplo). Los cuatro prompts que usan el servidor lo dicen de forma explícita, porque un agente que no lo sabe pierde la primera llamada.

Las herramientas MCP de un plugin llevan el prefijo `mcp__plugin_shopify-agents_shopify-dev__`, y así aparecen en el campo `tools` de cada agente. Ese campo es una lista cerrada: lo que no está ahí, el agente no lo ve. Por eso cada agente declara nombre por nombre las herramientas que usa, y por eso el gate arranca el servidor de verdad y comprueba que cada nombre exista. Si Shopify renombra una herramienta, falla el CI de este repositorio antes de fallar en la sesión de alguien.

Todos los agentes que usan el servidor tienen la misma instrucción de degradación: si las herramientas no aparecen en la sesión, siguen con lo que tienen y lo dicen en una línea.

### La telemetría se apaga en el paquete, no en la buena voluntad

Por defecto, el toolkit le reporta a Shopify las consultas, el código validado y, si el agente lo entrega, el mensaje literal de quien pregunta. Para una agencia que trabaja con el código de tiendas Plus de terceros, eso no puede depender de que cada persona se acuerde de apagarlo.

El paquete lo resuelve en tres capas. El `.mcp.json` arranca el servidor con `OPT_OUT_INSTRUMENTATION=true`, y el gate falla si alguien lo quita. Ningún agente corre los scripts de la skill, que reportan por su cuenta. Y ningún agente envía el campo `user_prompt`, que el servidor pide pero no exige.

### La description es el router, no la documentación

Claude decide a qué agente delegar leyendo el campo `description` de cada uno. No lee el cuerpo del archivo hasta que ya decidió delegar.

Por eso las cinco descripciones dicen cuándo delegar, no qué hace el agente por dentro. Tres de ellas incluyen una instrucción de proactividad o un momento concreto, porque la diferencia entre un agente que se usa y uno que no se usa suele ser esa frase.

## `shopify-explorer`

**Qué problema resuelve.** Nadie debería tocar la estructura de un tema o de una app sin saber qué sections y blocks hay, qué settings ya configuró el merchant, qué extensiones declara la app y con qué scopes. Averiguarlo a mano son veinte llamadas de Glob, Grep y Read que llenan la conversación de árboles de directorios y bloques de `{% schema %}`.

**Por qué haiku.** Es el agente más barato del paquete y el que más se invoca. Su trabajo es de reconocimiento de patrones sobre archivos con formato conocido: `templates/*.json` compone sections, `{% schema %}` declara settings, `shopify.extension.toml` declara un target. Identificar eso no necesita un modelo caro.

**Por qué la skill `shopify`.** Por su tabla de temas, que le dice a qué superficie pertenece cada archivo. No tiene Bash, así que no puede correr los scripts de la skill, y su prompt se lo recuerda.

**Qué recibe del servidor MCP.** `learn_shopify_api` y `search_docs_chunks`, para nombrar con precisión una pieza que el proyecto no explica por sí mismo. El prompt le prohíbe usarlas para explorar la documentación, que es trabajo del investigador: un cartógrafo barato que se pone a leer documentación deja de ser barato.

**Qué devuelve.** Un resumen estructurado de unas cuarenta líneas: tipo de proyecto, dónde está qué, sections y blocks, contratos expuestos y puntos de atención. Nunca contenido de archivos. Si necesitas el contenido, te da la ruta y las líneas.

## `shopify-reviewer`

**Qué problema resuelve.** En Shopify, lo caro se descubre después del deploy: un webhook sin verificación de HMAC, un token de la Admin API en un asset del tema, un setting renombrado que borra lo que el merchant había configurado, un scope nuevo que obliga a cada tienda a volver a aceptar la app. Este agente mete una revisión entre escribir el código y desplegarlo.

**Por qué `inherit`.** Es el único agente del paquete que hereda el modelo de la conversación principal, y es deliberado. Revisar código es la tarea donde la calidad del modelo se nota más directamente en la calidad del resultado, y también es donde el usuario ya expresó su preferencia al elegir con qué modelo trabajar.

**Por qué esos cuatro ejes.** Seguridad, scopes y configuración, performance, y contrato. Son los cuatro lugares donde un error en Shopify cuesta caro en producción: el primero expone datos de compradores, el segundo rompe instalaciones o la revisión de la App Store, el tercero se paga en límite de tasa y en Core Web Vitals, y el cuarto se paga en el editor de temas del merchant.

**Por qué tiene `Bash`.** Porque la primera instrucción del agente es correr `git diff`. Está acotado por instrucción a inspección: git, ls, lectura de fragmentos. Nada que toque una tienda.

**Qué recibe del servidor MCP.** Las cuatro herramientas útiles, con una instrucción precisa: verificar antes de reportar, nunca revisar en su lugar. `validate` comprueba GraphQL, componentes y Functions contra el esquema de la versión que fija el proyecto; `validate_theme` corre las comprobaciones de Liquid sobre los archivos que cambiaron. Un revisor que marca como inexistente un campo que sí existe en `2026-10` hace daño; con `validate` a mano, confirma antes de escribir.

**Por qué `memory: project`.** Cada proyecto tiene sus convenciones, sus falsos positivos ya discutidos y sus decisiones aceptadas. La memoria de proyecto le permite acumular ese contexto entre sesiones, con un límite explícito sobre qué nunca guardar: credenciales, dominios de tiendas, datos de compradores.

**Qué devuelve.** Tres niveles fijos, siempre en el mismo orden y con los mismos nombres: Crítico (bloquea el deploy), Aviso (corregir antes del release), Sugerencia. Si un nivel queda vacío, aparece igual con la palabra Ninguno, para que se note la diferencia entre "revisé y no encontré nada crítico" y "no llegué a revisar eso".

## `shopify-qa`

**Qué problema resuelve.** Theme Check, `shopify app build`, lint y tests generan cientos de líneas de salida de las que importan cinco. Ese ruido, en la conversación principal, desplaza contexto que sí importa.

**Por qué sonnet.** Haiku se queda corto porque filtrar una salida de build exige distinguir el error real de las líneas de stack que lo rodean y del warning que no importa. Opus sería desperdicio, porque una vez identificado el error no hay que razonar sobre él, hay que reportarlo con su archivo y su línea.

**Por qué la skill `shopify`.** Por el tema `use-shopify-cli`, que dice qué hace cada comando antes de correrlo, y por el tema `liquid`, para leer un hallazgo de Theme Check.

**La verificación que ningún test hace.** Renombrar o borrar un setting de un `{% schema %}` no rompe el build, no lo ve el lint y Theme Check no siempre lo detecta. Lo que rompe es la tienda: los valores que el merchant configuró en el editor quedan huérfanos. El agente lo revisa de forma explícita y lista qué settings quedaron así.

**Por qué no tiene herramientas MCP.** Su trabajo es correr comandos y filtrar salida; consultar documentación durante una verificación es exactamente el ruido que existe para evitar.

**Qué devuelve.** Si todo pasa, una línea. Si algo falla, solo las fallas, con archivo, línea, el mensaje recortado a lo esencial y las líneas de stack que apuntan a código del proyecto. Es el agente donde la regla de "vale por lo que no devuelve" se aplica de forma más literal.

## `shopify-integration-architect`

**Qué problema resuelve.** Es el único agente del paquete que emite juicio. Los otros cuatro reportan hechos; este propone una arquitectura y se hace responsable de los trade offs de esa propuesta.

**Por qué opus.** Porque diseñar una integración de stock o de pedidos entre Shopify y un ERP es la tarea donde equivocarse cuesta más y donde el error tarda más en aparecer. Una sincronización mal diseñada no falla el primer día: falla el día que el ERP se cae, los webhooks empiezan a fallar, Shopify termina eliminando la suscripción y nadie sabe qué pedidos no llegaron.

**Por qué los webhooks están en el centro.** Se entregan al menos una vez, pueden llegar repetidos y fuera de orden, y no garantizan la entrega. Eso hace que la reconciliación no sea opcional, y el prompt lo convierte en regla: ninguna propuesta sin reintento, sin reconciliación y sin las cuatro preguntas respondidas.

**Por qué una sección de Plus.** Porque los clientes Plus son justamente los que tienen ERP, varias tiendas, B2B y lógica de checkout propia. Functions, Checkout Extensibility, B2B, Markets y Flow cambian qué es posible y dónde debe vivir cada regla. El ejemplo más caro: querer consultar el ERP en tiempo real desde el checkout.

**Qué recibe del servidor MCP.** `learn_shopify_api` y `search_docs_chunks`, para diseñar sobre los límites y los topics reales y no sobre los recordados. La instrucción es consultar el servidor antes de WebFetch.

**Por qué `memory: project`.** Las decisiones arquitectónicas se toman una vez y se viven durante años. Un agente que no recuerda por qué se eligió Bulk Operations en lugar de webhooks para el catálogo va a proponer webhooks en la siguiente sesión.

**Qué devuelve.** Contexto entendido, opciones consideradas con sus trade offs (mínimo dos, porque una sola opción no es una decisión), recomendación con su porqué, puntos de falla, estrategia de reintento y reconciliación, y qué queda abierto.

## `shopify-docs-researcher`

**Qué problema resuelve.** Buscar en la documentación de Shopify consume mucho contexto para devolver poca información. Abres cuatro páginas de shopify.dev, la respuesta está en un párrafo de una de ellas, y las otras tres quedan ocupando la conversación para siempre.

**Por qué haiku.** Su trabajo es buscar y citar, no razonar. Encontrar el párrafo correcto y transcribir de dónde salió no necesita un modelo caro.

**Por qué no precarga ninguna skill.** Un agente de investigación que arranca con una skill en contexto arranca con una hipótesis sobre dónde está la respuesta, y esa hipótesis sesga la búsqueda. Sigue teniendo el tool `Skill`: si la pregunta cae claramente dentro de un tema, la carga porque la pregunta lo pidió.

**El orden de búsqueda.** Primero el servidor MCP, que lo tiene todo el que instaló el plugin. Segundo, las referencias de la skill, que son texto plano y se buscan con Grep. Tercero, la documentación del propio proyecto. Y solo después, WebFetch contra shopify.dev.

**Por qué `memory: user` y no `project`.** El mapa de la documentación de Shopify no cambia de un cliente a otro: qué `api` del servidor responde mejor cada tipo de pregunta, qué búsquedas dieron resultado, qué URLs son estables. Eso vale la pena acumularlo una vez y llevarlo a todos los proyectos.

**La regla de cita.** Toda afirmación va con su fuente. Si no encontró la respuesta, lo dice. Si aporta algo de su propio conocimiento, lo marca como no verificado en la documentación. Esa última parte es la que convierte al agente en algo en lo que se puede confiar.

## Por qué no hay más agentes

La pregunta que decide si vale la pena un agente nuevo es siempre la misma: ¿esta tarea genera ruido intermedio que la conversación principal no necesita ver?

Si la respuesta es no, el agente sale más caro que el trabajo. Un subagente arranca en frío, sin el contexto de lo que ya se habló, lo que ya se probó y lo que ya se descartó. Pagas ese arranque a cambio de que el ruido se quede afuera. Cuando no hay ruido que dejar afuera, solo pagas.

Por eso no hay un agente "Liquid Developer" ni un agente "Hydrogen Developer". Escribir código es la tarea que más se beneficia del contexto acumulado y menos ruido intermedio genera. Pertenece a la conversación principal, que ya tiene la skill `shopify` y el servidor MCP para hacerlo bien.

Y por eso tampoco un agente es siempre la respuesta correcta. Si lo que necesitas es una restricción sobre un directorio concreto, una regla en `.claude/rules/` con `paths:` acotado es más barata y más precisa. Si lo que necesitas es que el equipo comparta convenciones, eso va en `CLAUDE.md`.

Los agentes son para el trabajo ruidoso, acotado y repetitivo. Cinco alcanzan.
