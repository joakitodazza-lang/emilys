/* Mapa de zonas de entrega + verificador de dirección (Leaflet + OSM + Nominatim).
   Las zonas se editan en zonas.json (no acá). */
(function () {
  "use strict";
  var mapEl = document.getElementById("map");
  if (!mapEl || typeof L === "undefined") return;

  fetch("zonas.json")
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      var local = cfg.local, envio = cfg.envio, zonas = cfg.zonas;

      var map = L.map("map", { scrollWheelZoom: false }).setView([local.lat, local.lng], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      zonas.forEach(function (z) {
        L.polygon(z.poligono, {
          color: z.color, weight: 2, fillColor: z.color, fillOpacity: 0.28
        }).addTo(map).bindTooltip(z.nombre);
      });

      L.marker([local.lat, local.lng]).addTo(map)
        .bindPopup("<b>" + local.nombre + "</b><br>" + local.direccion);

      var money = function (n) { return "$" + Number(n).toLocaleString("es-AR"); };

      var legend = document.getElementById("zone-legend");
      if (legend) {
        legend.innerHTML = zonas.map(function (z) {
          return '<span><i style="background:' + z.color + '"></i>' + z.nombre + "</span>";
        }).join("") + "<span>Envío " + money(envio.costo) + " · " + envio.tiempo + "</span>";
      }

      // Punto dentro de polígono (ray casting) — puntos [lat, lng]
      function inside(pt, poly) {
        var x = pt[1], y = pt[0], hit = false;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          var xi = poly[i][1], yi = poly[i][0], xj = poly[j][1], yj = poly[j][0];
          var intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
          if (intersect) hit = !hit;
        }
        return hit;
      }
      function zoneOf(pt) {
        for (var i = 0; i < zonas.length; i++) {
          if (inside(pt, zonas[i].poligono)) return zonas[i];
        }
        return null;
      }

      var form = document.getElementById("zone-form");
      var input = document.getElementById("zone-input");
      var resultEl = document.getElementById("zone-result");
      var addrMarker = null;

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = input.value.trim();
        if (q.length < 4) { resultEl.className = "zone-result"; resultEl.textContent = ""; return; }

        resultEl.className = "zone-result";
        resultEl.textContent = "Buscando…";

        var full = q + ", Wilde, Avellaneda, Buenos Aires, Argentina";
        fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(full))
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data || !data.length) {
              resultEl.className = "zone-result no";
              resultEl.textContent = "No encontramos esa dirección. Probá con calle y altura.";
              return;
            }
            var lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
            if (addrMarker) map.removeLayer(addrMarker);
            addrMarker = L.marker([lat, lng]).addTo(map);
            map.setView([lat, lng], 15);

            var z = zoneOf([lat, lng]);
            if (z) {
              resultEl.className = "zone-result ok";
              resultEl.textContent = "✅ ¡Llegamos a " + z.nombre + "! Envío " + money(envio.costo) + " · " + envio.tiempo + ".";
              addrMarker.bindPopup("Zona: " + z.nombre).openPopup();

              // Prellenamos el pedido: marcamos delivery y cargamos la dirección
              var d = document.querySelector('input[name="deliveryMethod"][value="delivery"]');
              var street = document.getElementById("addr-street");
              if (d && street) {
                d.checked = true;
                d.dispatchEvent(new Event("change", { bubbles: true }));
                street.value = data[0].display_name.split(",").slice(0, 2).join(",").trim();
              }
            } else {
              resultEl.className = "zone-result no";
              resultEl.textContent = "🛵 Esa dirección quedó fuera de las zonas dibujadas. Escribinos por WhatsApp y lo confirmamos.";
              addrMarker.bindPopup("Fuera de zona").openPopup();
            }
          })
          .catch(function () {
            resultEl.className = "zone-result no";
            resultEl.textContent = "No pudimos verificar ahora. Probá de nuevo.";
          });
      });

      setTimeout(function () { map.invalidateSize(); }, 300);
    })
    .catch(function () { mapEl.parentElement.style.display = "none"; });
})();
