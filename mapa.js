/* Mapa de zonas de entrega + verificador de dirección (Leaflet + OSM + Nominatim).
   El VERIFICADOR funciona aunque el mapa (Leaflet) no cargue.
   Las zonas se editan en zonas.json (no acá). */
(function () {
  "use strict";

  var form = document.getElementById("zone-form");
  var input = document.getElementById("zone-input");
  var resultEl = document.getElementById("zone-result");
  var mapEl = document.getElementById("map");
  var legendEl = document.getElementById("zone-legend");
  if (!form || !input || !resultEl) return;

  var cfg = null, map = null, addrMarker = null, box = null;

  var money = function (n) { return "$" + Number(n).toLocaleString("es-AR"); };
  function setResult(text, cls) { resultEl.className = "zone-result" + (cls ? " " + cls : ""); resultEl.textContent = text; }

  fetch("zonas.json")
    .then(function (r) { return r.json(); })
    .then(function (data) { cfg = data; box = bbox(cfg); renderLegend(); initMap(); })
    .catch(function () {});

  // Caja que envuelve todas las zonas (para limitar la búsqueda a la zona)
  function bbox(cfg) {
    var minLat = cfg.local.lat, maxLat = cfg.local.lat, minLng = cfg.local.lng, maxLng = cfg.local.lng;
    cfg.zonas.forEach(function (z) {
      z.poligono.forEach(function (p) {
        minLat = Math.min(minLat, p[0]); maxLat = Math.max(maxLat, p[0]);
        minLng = Math.min(minLng, p[1]); maxLng = Math.max(maxLng, p[1]);
      });
    });
    var padLat = (maxLat - minLat) * 0.2 + 0.01, padLng = (maxLng - minLng) * 0.2 + 0.01;
    return { minLat: minLat - padLat, maxLat: maxLat + padLat, minLng: minLng - padLng, maxLng: maxLng + padLng };
  }
  function viewboxStr() { return box.minLng + "," + box.maxLat + "," + box.maxLng + "," + box.minLat; }
  function inBox(lat, lng) { return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng; }

  function renderLegend() {
    if (!legendEl || !cfg) return;
    legendEl.innerHTML = cfg.zonas.map(function (z) {
      return '<span><i style="background:' + z.color + '"></i>' + z.nombre + "</span>";
    }).join("") + "<span>Envío " + money(cfg.envio.costo) + " · " + cfg.envio.tiempo + "</span>";
  }

  function initMap() {
    if (!mapEl || typeof L === "undefined" || map || !cfg) {
      if (mapEl && typeof L === "undefined") mapEl.style.display = "none";
      return;
    }
    var local = cfg.local;
    map = L.map("map", { scrollWheelZoom: false }).setView([local.lat, local.lng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    cfg.zonas.forEach(function (z) {
      L.polygon(z.poligono, { color: z.color, weight: 2, fillColor: z.color, fillOpacity: 0.28 }).addTo(map).bindTooltip(z.nombre);
    });
    L.marker([local.lat, local.lng]).addTo(map).bindPopup("<b>" + local.nombre + "</b><br>" + local.direccion);
    setTimeout(function () { map.invalidateSize(); }, 300);
  }

  function inside(pt, poly) {
    var x = pt[1], y = pt[0], hit = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][1], yi = poly[i][0], xj = poly[j][1], yj = poly[j][0];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) hit = !hit;
    }
    return hit;
  }
  function zoneOf(pt) {
    if (!cfg) return null;
    for (var i = 0; i < cfg.zonas.length; i++) { if (inside(pt, cfg.zonas[i].poligono)) return cfg.zonas[i]; }
    return null;
  }

  // Geocodificación en dos pasos: 1) estricta dentro de la caja; 2) flexible con contexto.
  function geocode(q) {
    var base = "https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=ar";
    var vb = "&viewbox=" + viewboxStr();
    return fetch(base + vb + "&bounded=1&q=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.length) return d[0];
        return fetch(base + vb + "&q=" + encodeURIComponent(q + ", Wilde, Avellaneda, Buenos Aires"))
          .then(function (r) { return r.json(); })
          .then(function (d2) { return (d2 && d2.length) ? d2[0] : null; });
      });
  }

  // Nombre corto de la dirección encontrada (para que el cliente confirme)
  function shortAddr(d) {
    var a = d.address || {};
    var calle = a.road || "";
    var num = a.house_number ? a.house_number + " " : "";
    var loc = a.suburb || a.town || a.city || a.village || a.city_district || "";
    var s = (num + calle).trim();
    return (s ? s : d.display_name.split(",")[0]) + (loc ? ", " + loc : "");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (q.length < 4) { setResult("Escribí tu calle y la altura (ej: San Martín 1200).", "no"); return; }
    if (!cfg) { setResult("Un segundo, estamos cargando las zonas… probá de nuevo.", ""); return; }

    setResult("Buscando…", "");
    geocode(q)
      .then(function (d) {
        if (!d) { setResult("No encontramos esa dirección por acá. Probá con calle y altura (ej: San Martín 1200).", "no"); return; }
        var lat = parseFloat(d.lat), lng = parseFloat(d.lon);

        if (!inBox(lat, lng)) {
          setResult("Esa dirección nos dio lejos de la zona. Revisá la calle y la altura, o escribinos por WhatsApp.", "no");
          return;
        }

        if (map) {
          if (addrMarker) map.removeLayer(addrMarker);
          addrMarker = L.marker([lat, lng]).addTo(map);
          map.setView([lat, lng], 16);
        }

        var found = shortAddr(d);
        var z = zoneOf([lat, lng]);
        if (z) {
          setResult("✅ ¡Llegamos! (" + found + ") · Zona " + z.nombre + " · Envío " + money(cfg.envio.costo) + " · " + cfg.envio.tiempo + ".", "ok");
          if (map && addrMarker) addrMarker.bindPopup(found + "<br>Zona: " + z.nombre).openPopup();
          var deliv = document.querySelector('input[name="deliveryMethod"][value="delivery"]');
          var street = document.getElementById("addr-street");
          if (deliv && street) { deliv.checked = true; deliv.dispatchEvent(new Event("change", { bubbles: true })); street.value = found; }
        } else {
          setResult("🛵 " + found + " quedó fuera de nuestras zonas. Escribinos por WhatsApp y lo confirmamos.", "no");
          if (map && addrMarker) addrMarker.bindPopup(found + "<br>Fuera de zona").openPopup();
        }
      })
      .catch(function () { setResult("No pudimos verificar ahora. Probá de nuevo en unos segundos.", "no"); });
  });
})();
