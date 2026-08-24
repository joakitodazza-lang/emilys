/*
 * Armado del menú desde menu.json.
 * Vercel corre este script en cada deploy: reescribe el menú como HTML real
 * (para que Google lo indexe) y sincroniza los datos que usa el carrito.
 * Para cambiar precios/productos: editá menu.json y subilo. No toques index.html.
 */
import { readFileSync, writeFileSync } from "node:fs";

const { categories } = JSON.parse(readFileSync("menu.json", "utf8"));

const money = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0
});
const formatPrice = v => money.format(v);
const slug = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function productTemplate(item) {
  const media = item.image
    ? '<img src="' + item.image + '" alt="' + item.name + '" />'
    : '<span aria-hidden="true">' + item.emoji + '</span>';

  const hasChoice = item.variants.length > 1;
  const first = item.variants[0];

  const variantsHtml = hasChoice
    ? '<div class="variants" role="group" aria-label="Elegí una opción de ' + item.name + '">' +
        item.variants.map((v, i) =>
          '<button type="button" class="variant" data-choose="' + i + '" aria-pressed="' + (i === 0) + '">' +
            '<span>' + v.label + '</span><small>' + formatPrice(v.price) + '</small>' +
          '</button>'
        ).join("") +
      '</div>'
    : "";

  return '<li class="product" data-id="' + item.id + '" data-vi="0">' +
    '<div class="product-media">' + media + '</div>' +
    '<div class="product-body">' +
      '<h3 class="product-name">' + item.name +
        (item.badge ? '<span class="tag">' + item.badge + '</span>' : "") +
      '</h3>' +
      (item.description ? '<p class="product-desc">' + item.description + '</p>' : "") +
      variantsHtml +
      '<div class="product-footer">' +
        '<p class="product-price" data-price>' + formatPrice(first.price) + '</p>' +
        '<div class="stepper">' +
          '<button type="button" data-action="remove" aria-label="Quitar una unidad de ' + item.name + '" disabled>&minus;</button>' +
          '<span class="qty" data-qty aria-live="polite" aria-label="Cantidad de ' + item.name + '">0</span>' +
          '<button type="button" data-action="add" aria-label="Agregar una unidad de ' + item.name + '">+</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</li>';
}

function menuHtml() {
  return categories.map(group => {
    const items = group.items.map(productTemplate).join("");
    const note = group.note ? '<p class="group-note">' + group.note + '</p>' : "";
    return '<section class="menu-board" id="' + slug(group.category) + '">' +
      '<div class="menu-board-body">' +
        '<h2 class="category-title">' + group.category + '</h2>' +
        note +
        '<ul class="product-list">' + items + '</ul>' +
      '</div>' +
    '</section>';
  }).join("");
}

let html = readFileSync("index.html", "utf8");

// 1) Menú visible como HTML real (SEO)
html = html.replace(
  /(<!-- MENU:START -->)[\s\S]*?(<!-- MENU:END -->)/,
  "$1" + menuHtml() + "$2"
);

// 2) Datos del menú para el carrito (mismo origen: menu.json)
const dataBlock =
  "/* MENU-DATA:START (lo mantiene sincronizado el armado desde menu.json) */\n" +
  "    const MENU = " + JSON.stringify(categories, null, 2).replace(/\n/g, "\n    ") + ";\n" +
  "    /* MENU-DATA:END */";
html = html.replace(
  /\/\* MENU-DATA:START[\s\S]*?\/\* MENU-DATA:END \*\//,
  dataBlock
);

writeFileSync("index.html", html);

const total = categories.reduce((n, c) => n + c.items.length, 0);
console.log(`Menú armado: ${total} productos en ${categories.length} categorías.`);
