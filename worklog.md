---
Task ID: 1
Agent: Z.ai Code (main)
Task: Crear página ultrasinge para subir archivos que detecte cuando se suba y continue (extracción de zip)

Work Log:
- Analicé el estado del proyecto Next.js 16 + TS + Tailwind + shadcn/ui (ya inicializado, sin contenido en /)
- Creé API route `/api/upload` (POST multipart) que guarda el archivo recibido en `/home/z/my-project/upload/` con nombre saneado y devuelve metadatos (nombre, tamaño, tipo, path, timestamp).
- Creé API route `/api/extract` (POST JSON con `{name}`) que:
  - Verifica que el archivo exista en `/home/z/my-project/upload/`
  - Si es `.zip`, usa el binario `unzip` del sistema (verificado presente: UnZip 6.00) para extraer en `<name>.extracted/`
  - Camina el directorio extraído con `fs.statSync` + `readdirSync` y devuelve array de entries (nombre, path, tamaño, isDir, extensión)
  - Límite de 200 entries en la respuesta para no inflar el payload
- Construí `src/app/page.tsx` minimalista: drop zone con `onDragOver/onDrop`, input hidden clickable, estados (idle/uploading/uploaded/extracting/done/error), detalle del upload con icono + metadata, panel scrollable con el árbol extraído, footer sticky con info de dónde se guardan los archivos.
- Verifiqué con `bun run lint` (sin errores) y revisé `dev.log` (server OK en puerto 3000).
- Verificación end-to-end con Agent Browser:
  - Abrí `http://localhost:3000/` y snapshot confirmó la UI (heading "Subir archivo" + drop zone clickable)
  - Llamé a `/api/upload` con un zip de prueba vía curl: guardado OK con metadata correcta
  - Llamé a `/api/extract` con el nombre del zip: devolvió 7 entries (3 dirs + 4 files) con rutas absolutas y tamaños correctos
  - Simulé un pick de archivo en el navegador con `DataTransfer` + `File` sobre el input hidden: la página transicionó "idle → uploading → uploaded (✓)" y apareció el botón "Subir otro"
  - Confirmé en disco: `prueba.txt` (23 bytes) se guardó correctamente en `/home/z/my-project/upload/`
- Limpié artefactos de prueba y reseteé el navegador para que el usuario arranque limpio.

Stage Summary:
- Archivos creados:
  - `/home/z/my-project/src/app/api/upload/route.ts` (POST multipart → guarda archivo)
  - `/home/z/my-project/src/app/api/extract/route.ts` (POST JSON → unzip + listado)
  - `/home/z/my-project/src/app/page.tsx` (UI minimalista de subida + auto-extracción)
- Flujo verificado: arrastrar/click → subir a `/api/upload` → si es zip llamar a `/api/extract` → mostrar árbol extraído.
- Footer sticky implementado con `min-h-screen flex flex-col` + `mt-auto` en el footer.
- Directorio `/home/z/my-project/upload/` limpio y listo para que el usuario suba su `agent-toolkit-bootloader-v1.1.zip`.
- Próximo paso sugerido: cuando el usuario suba su zip, extender el flujo para detectar qué tipo de proyecto es (Node/Python/estático) y ofrecer desplegarlo/integrarlo en este Next.js.
