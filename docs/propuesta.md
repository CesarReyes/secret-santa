# Amigo Secreto — Propuesta

PWA mobile first para organizar el amigo secreto con familia y amigos. Sencilla, en español, con colores navideños, y con un sorteo que nadie puede descubrir, ni siquiera quien tenga acceso a la base de datos.

## Decisiones tomadas

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Login | Usuario + PIN creados por el admin, sin correo. En el primer acceso cada quien cambia su PIN o contraseña |
| 2 | Hosting | GitHub Pages |
| 3 | Moneda | EUR |
| 4 | Listas de deseos | Abiertas a todo el grupo, para que haya regalos adicionales |
| 5 | Primera versión | MVP + chat anónimo + estado del regalo |

## 1. Qué hacen las apps conocidas

Revisé Elfster, DrawNames, GiftList, Surprise Santa y Easy Secret Santa. Lo que todas tienen:

- Sorteo con **exclusiones** (parejas no se regalan entre sí) y opción de rehacerlo.
- **Lista de deseos** con enlaces, precio y foto.
- **Presupuesto** y fecha del intercambio, con cuenta regresiva.
- **Invitar por enlace** sin tanto registro. La fricción de crear cuenta es la queja más común de Elfster.

Lo que distingue a las mejores:

- **Chat anónimo con tu amigo secreto**: le preguntas talla o gustos sin revelar quién eres.
- **"Ya lo compré" oculto al dueño**: marcas un artículo de su lista y él no lo ve.
- **"Tu amigo secreto ya vio tu lista"**: confirma que alguien la leyó.
- **Recordatorios** antes de la fecha y para quien no ha visto su sorteo.

El punto débil común: en casi todas el organizador o el servidor puede ver las parejas. Ahí es donde esta app se diferencia.

## 2. Alcance

### Primera versión

| Área | Qué incluye |
| --- | --- |
| Acceso | Usuario + PIN. El admin da de alta a cada persona y le comparte su acceso. Cambio obligatorio en el primer acceso (sección 3) |
| Grupos | Crear grupo, nombre, emoji, fecha y lugar del intercambio, monto mínimo y máximo en EUR |
| Participantes | Alta, edición y baja. Restablecer PIN. Roles: dueño, admin, miembro |
| Sorteo | Secreto de verdad (sección 4). Exclusiones por pareja. Solo admins lo lanzan o rehacen |
| Mi amigo secreto | Revelado con animación de abrir regalo. Muestra su lista de deseos |
| Lista de deseos | Artículos con texto, enlace (con vista previa), fotos, precio aproximado y prioridad. Visible para todo el grupo |
| Chat anónimo | Hablas con tu amigo secreto sin revelar quién eres, y con quien te regala sin saber quién es. Cifrado (sección 4.4) |
| Estado del regalo | "Ya lo compré" y "Entregado" para tu propio regalo. El admin ve cuántos van, no quiénes |
| Muro | Mensajes cortos al grupo, en tiempo real, con reacciones |
| Permisos | Todo lo administrativo validado en la base de datos (RLS), no solo ocultando botones |

### Siguientes versiones

1. **"Ya lo compré" oculto al dueño** en artículos de la lista. Con listas abiertas y regalos adicionales evita que dos personas compren lo mismo. Es pequeño; lo podemos meter en la primera versión si quieres.
2. **Recordatorios por push** (Web Push funciona en iPhone con la PWA instalada).
3. **Día de la revelación**: cada quien decide revelar "yo era tu amigo secreto" en el muro.
4. **Ediciones anuales**: el mismo grupo repite cada año sin volver a capturar a la familia.
5. **Ideas de regalo** dentro del rango, o un tema del año.

### Fuera de alcance

Pagos, compras dentro de la app, envío por correo postal, apps nativas, login con correo o Google.

## 3. Acceso con usuario y PIN

### 3.1 Flujo

1. El admin crea a la persona: nombre visible y usuario (por ejemplo `lucia`). La app genera un PIN temporal de 6 dígitos.
2. El admin comparte el acceso: tarjeta con usuario, PIN y QR del enlace a la app, lista para mandar por WhatsApp o imprimir.
3. Primer acceso: la persona entra con usuario y PIN. La app la obliga a elegir un PIN nuevo (mínimo 6 dígitos) o una contraseña. En ese momento se generan sus llaves del sorteo.
4. Si alguien olvida su PIN, un admin del grupo lo restablece y se repite el paso 3.

### 3.2 Cómo encaja con Supabase Auth

Supabase Auth necesita un correo o un teléfono, así que cada usuario tiene un correo sintético que nadie ve: `lucia@usuarios.amigo-secreto.invalid`. El dominio `.invalid` está reservado y nunca recibe correo.

- **Altas y restablecimientos** pasan por la Edge Function `accounts` con la service role (`auth.admin.createUser` / `updateUserById`). Comprueba que quien llama es admin del grupo. Las altas directas a Supabase Auth están desactivadas (`[auth] enable_signup = false`).
- **Login**: la app convierte el usuario en el correo sintético y llama a `signInWithPassword`.
- **Cambio obligatorio**: la bandera `must_change_pin` vive en `app_metadata`, que solo el servidor puede escribir. La función cambia la contraseña y limpia la bandera en un solo paso, así nadie se la salta desde la consola del navegador. Rechaza volver a usar el PIN actual.
- **Cambiar el PIN cierra todas las sesiones** de esa persona. La app vuelve a entrar sola con el PIN nuevo.
- **Usuarios únicos en toda la app**, en minúsculas y sin acentos (`Lucía` → `lucia`). Una persona puede estar en varios grupos con el mismo acceso.
- **Quién restablece a quién**: un admin solo restablece a alguien de rango menor en su grupo, y nunca a quien administra otro grupo (si no, podría quedarse con ese grupo).
- **Fuerza bruta**: Supabase limita los intentos de login a 15 cada 5 minutos por IP. Un bloqueo por cuenta necesitaría pasar el login por una función propia; para una familia no compensa.

### 3.3 Qué puede y qué no puede hacer un admin

Un admin que restablece el PIN de alguien puede entrar como esa persona. Lo que **no** puede es ver su amigo secreto ni leer su chat, porque la llave privada de esa persona está cifrada con su PIN propio, no con el temporal. Esto se explica en la sección 4.

## 4. Sorteo realmente secreto

### 4.1 Objetivo

Que la pareja giver → receiver solo la conozca el giver. Ni el admin del grupo, ni quien abra Supabase Studio, ni un respaldo filtrado.

### 4.2 Llaves

1. Al cambiar el PIN temporal, el navegador genera un par de llaves con WebCrypto (P-256 ECDH). La llave pública va a la base de datos.
2. La llave privada se guarda en el dispositivo (IndexedDB) y en un respaldo cifrado en la base de datos, para entrar desde otro teléfono.
3. El respaldo se cifra con una llave que combina dos cosas:
   - el **PIN** de la persona, con PBKDF2 (600 000 iteraciones);
   - un **pepper** que entrega una Edge Function solo a la persona ya autenticada: `HMAC(secreto_del_servidor, user_id)`. El secreto vive en los secretos de la función, no en la base de datos.

   Por eso un PIN de 6 dígitos basta: quien solo tenga la base de datos no puede probar el millón de PINs sin el pepper.
4. Al cambiar el PIN, el navegador vuelve a cifrar el respaldo con el PIN nuevo.

### 4.3 Sorteo

La función de sorteo corre en el servidor, no en el navegador del admin (si no, el admin lo vería):

- Lee participantes, llaves públicas y exclusiones. Nadie puede quedar sin llave: el sorteo no arranca hasta que todos hicieron su primer acceso.
- Genera una permutación aleatoria sin puntos fijos que respete exclusiones, con `crypto.getRandomValues`.
- Para cada giver cifra `receiver_id` con su llave pública (ECDH efímero + AES-GCM).
- Guarda solo `{group_id, giver_id, ciphertext}`. La pareja en claro nunca toca la base de datos ni los logs.

El giver descifra en su teléfono. Quien abra la base de datos ve que Ana tiene una asignación y un bloque cifrado. Nada más.

### 4.3.1 Cómo quedó implementado

- **Código compartido** entre la app y el servidor: `supabase/functions/_shared/crypto.ts` (llaves, sobre cifrado, respaldo) y `supabase/functions/_shared/draw.ts` (sorteo). Ambos con tests.
- **Sobre cifrado**: ECDH P-256 efímero + HKDF-SHA256 + AES-256-GCM. El AAD es `grupo:quien_regala`, así que un cifrado movido a otra fila no abre.
- **Sorteo**: busca primero una sola cadena que pase por todos (A→B→C→…→A), que evita parejas cerradas A↔B. Si las exclusiones no lo permiten, acepta cualquier reparto válido. Aleatoriedad con `crypto.getRandomValues`.
- **Función `draw`**: solo admins, exige 3+ personas, que todos hayan entrado y tengan llave. No registra ni devuelve parejas. Escribe todo en una transacción (`store_draw`, solo service role).
- **Deshacer** (`undo_draw`): borra las asignaciones y reabre el grupo. No hay forma de recuperarlas.
- **Llaves en el dispositivo**: la privada se guarda en IndexedDB. Al entrar con el PIN se restaura del respaldo si hace falta; al cambiar el PIN se vuelve a cifrar el respaldo. Un PIN incorrecto nunca reemplaza la llave, porque antes se verifica con el login.
- **Pepper**: `KEY_PEPPER_SECRET` en los secretos de Supabase. **No se puede rotar**: cambiarlo deja inservibles todos los respaldos.
- **Avance**: `draw_progress` dice cuántos ya vieron su asignación, sin decir quién tiene a quién.

### 4.4 Chat anónimo

En el sorteo, la función crea un buzón por pareja con un secreto aleatorio, y lo cifra dos veces: una para el giver y otra para el receiver. Los mensajes se guardan bajo `hash(secreto)`, cifrados con una llave derivada del secreto, y **sin autor**, solo con el lado (`santa` o `regalado`). Escribir y leer pasa por una función que pide el secreto, así RLS no necesita saber quién es quién.

Quien vea la base de datos ve buzones y mensajes ilegibles, sin saber de quién son.

#### Cómo quedó implementado el chat

- **Un secreto por pareja**, generado en el sorteo. Va dentro de la asignación de quien regala, y en una fila aparte (`mailbox_receivers`) sellada para quien recibe.
- Del secreto salen dos valores, con HKDF: **`access`**, que se manda al servidor para leer y escribir, y la **llave** que cifra los mensajes, que nunca sale de los dos teléfonos. La base guarda solo `sha256(access)`.
- **Mensajes sin autor**: solo `side` (`santa` o `giftee`), autenticado dentro del cifrado: cambiar el lado rompe el mensaje.
- **RPCs** `mailbox_read` y `mailbox_send`: conocer `access` es el permiso, y además hay que ser del grupo. Las tablas no se leen directo.
- **Orden de filas**: asignaciones, filas de quien recibe y buzones se insertan cada lista en un orden aleatorio propio. Si no, el orden físico de las filas podría emparejarlas.
- **Lo que sí puede ver el servidor** mientras se usa: qué usuario consulta qué buzón (la petición lleva su sesión). Postgres no lo guarda, pero un operador con acceso a logs de peticiones podría inferir parejas por actividad. Para una familia es aceptable.
- El chat consulta cada 8 segundos mientras está abierto.

### 4.5 Estado del regalo

`assignments.gift_status` (`pendiente`, `comprado`, `entregado`) lo cambia solo el giver. Como la fila es del giver y no dice a quién regala, el admin puede contar cuántos van sin descubrir parejas.

### 4.6 Lo que hay que aceptar

- **Confianza en el código de la función de sorteo.** Ve las parejas unos milisegundos en memoria. El código está en GitHub para auditarlo. Un protocolo sin ninguna parte de confianza exige que todos estén en línea al mismo tiempo; no vale la pena para una familia.
- **Olvidar el PIN sin tener otro teléfono con sesión abierta** pierde la llave. El admin restablece el PIN, pero la asignación vieja ya no se puede leer: hay que rehacer el sorteo completo. Mientras haya un dispositivo con sesión abierta, cambiar el PIN no pierde nada.
- **El admin conoce el PIN temporal.** Podría entrar antes que un niño y crear él las llaves. Se notaría porque el niño ya no podría entrar. Es aceptable en familia.
- **"No repetir la pareja del año pasado"** solo es posible guardando un HMAC con el secreto del servidor. Lo dejo para las ediciones anuales.

## 5. Stack

Mismo stack que `hands-notes-taker`, más shadcn/ui.

| Capa | Elección |
| --- | --- |
| UI | React 18 + TypeScript + Vite |
| Componentes | shadcn/ui sobre Tailwind v4 (Button, Card, Dialog, Drawer, Sheet, Form, Input OTP para el PIN, Avatar, Badge, Tabs, Sonner) |
| Estado | zustand. TanStack Query para datos remotos |
| Rutas | React Router (en modo hash, para que GitHub Pages no dé 404 al recargar) |
| Backend | Supabase: Postgres + RLS, Auth, Storage (fotos), Realtime (muro y chat), Edge Functions (cuentas, sorteo, pepper, chat, vista previa de enlaces) |
| Cripto | WebCrypto en navegador y en Deno, sin librerías extra |
| PWA | vite-plugin-pwa, instalable, shell offline |
| Tests | Vitest: sorteo con pruebas de propiedad, cifrado de ida y vuelta, RLS contra Supabase local |
| CI/CD | GitHub Actions: test + build + deploy a GitHub Pages, igual que hands-notes |

**Repo público**: `CesarReyes/secret-santa` es público para poder usar GitHub Pages sin Pro. El código no tiene secretos: la llave de Supabase que va al navegador es pública por diseño, y los secretos (service role, secreto del pepper) viven en Supabase. Que el código sea público además permite auditar la función de sorteo.

## 6. Modelo de datos (borrador)

```
profiles          id (auth.users), username (único), display_name, avatar
user_keys         user_id, public_key, key_backup (cifrado), salt
groups            id, name, emoji, event_at, location, currency ('EUR'), budget_min, budget_max, status (open|drawn|done)
group_members     group_id, user_id, role (owner|admin|member), joined_at
exclusions        group_id, a_user, b_user
assignments       group_id, giver_id, ciphertext, mailbox_key_giver, gift_status, viewed_at
mailbox_receivers group_id, receiver_id, mailbox_key_receiver   -- secreto cifrado para el regalado
mailboxes         id = hash(secreto), group_id
mailbox_messages  mailbox_id, side (santa|regalado), ciphertext, created_at
wishlist_items    id, user_id, title, note, url, url_preview, price, priority, position
wishlist_photos   item_id, storage_path
posts             id, group_id, author, body, created_at
post_reactions    post_id, user_id, emoji
```

Las listas de deseos son de la persona, no del grupo: si estás en dos grupos, mantienes una sola lista. RLS la deja ver a quien comparta al menos un grupo contigo.

RLS con funciones auxiliares `is_member(group_id)`, `is_admin(group_id)` y `shares_group(user_id)`. `assignments` y `mailbox_receivers` solo se leen si la fila es tuya, y solo la función de sorteo los escribe.

## 7. Diseño visual

- Paleta: rojo navidad `#C8102E`, verde pino `#14532D`, dorado `#D4A017`, crema `#FFF8EE`, con modo oscuro tipo noche (azul profundo + nieve).
- Tipografía amable, por ejemplo "Fraunces" para títulos e "Inter" para texto.
- Navegación inferior con 4 pestañas: **Grupo**, **Mi amigo secreto** (con el chat), **Listas**, **Muro**.
- Detalles: nieve ligera en el encabezado (respetando "reducir movimiento"), revelado con animación de abrir regalo, cuenta regresiva.
- Precios en formato español: `25,00 €`.

## 8. Plan de trabajo

1. Proyecto base: Vite + React + Tailwind + shadcn + PWA + CI a GitHub Pages.
2. Esquema, RLS, cuentas con usuario y PIN, cambio obligatorio. Migraciones en `supabase/migrations`.
3. Grupos, participantes, roles, tarjetas de acceso.
4. Llaves, pepper y función de sorteo, con pruebas.
5. Mi amigo secreto, estado del regalo y chat anónimo.
6. Listas de deseos con fotos y vista previa de enlaces.
7. Muro en tiempo real.
8. Pulido visual, íconos, instalación y deploy.
