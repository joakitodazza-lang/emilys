# Emily's 🍔

Landing page de pedidos para una hamburguesería estilo American Diner. Los clientes
arman su pedido y lo envían directo al WhatsApp del local.

## Características

- Diseño responsivo (mobile-first) con estética diner: azul cobalto, cuadros rojos y piso ajedrezado.
- Menú por categorías con control de cantidades (+ / −).
- Carrito con total en tiempo real.
- Formulario de cliente (nombre + método de entrega).
- Botón que genera el pedido formateado y lo abre en WhatsApp (`wa.me`).
- Tablero de avisos del día tipo marquesina retro.

Todo vive en un único archivo estático: **`index.html`** (HTML + CSS + JavaScript, sin dependencias ni build).

## Configuración

Antes de publicar, editá el objeto `CONFIG` dentro de `index.html`:

| Campo | Descripción |
|-------|-------------|
| `whatsappNumber` | Número del local en formato internacional, sin `+` ni espacios (ej. Argentina: `5491155957052`). |
| `currency` / `locale` | Moneda y formato regional (ej. `ARS` / `es-AR`). |
| `notices` | Avisos del día que se muestran en la marquesina. |

El menú se edita en el arreglo `MENU` del mismo archivo.

## Despliegue

Sitio estático: no requiere build. Vercel sirve `index.html` directamente desde la raíz.
