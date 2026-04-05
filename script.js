const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbz5bnOOInh737Y9pUJAMrmh_674YMbYDaAo4LO7KGAMkXH3xI85TBj_ay1ly0hgE1wq/exec';
const KANTOR_COORDS = [-7.764074431291946, 110.37257246355749];

let map, markersLayer, allData = [];
let currentBasemap; // Variabel pelacak basemap aktif

// Konfigurasi Layer GeoJSON dengan Label & Simbologi
let adminLayers = {
    desa: L.geoJSON(null, { 
        style: { color: "#3388ff", weight: 1, fillOpacity: 0.05 },
        onEachFeature: function (feature, layer) {
            if (feature.properties && feature.properties.WADMKD) {
                layer.bindTooltip(feature.properties.WADMKD, { permanent: true, direction: "center", className: "label-desa" });
            }
        }
    }),
    kecamatan: L.geoJSON(null, { 
        style: { color: "#6f42c1", weight: 2, fillOpacity: 0 },
        onEachFeature: function (feature, layer) {
            if (feature.properties && feature.properties.WADMKC) {
                layer.bindTooltip(feature.properties.WADMKC, { permanent: true, direction: "center", className: "label-kecamatan" });
            }
        }
    }),
    kabupaten: L.geoJSON(null, { style: { color: "#2c3e50", weight: 3, fillOpacity: 0 } }),
    jalan: L.geoJSON(null, { 
        style: function(feature) {
            // Logika pewarnaan jaringan jalan berdasarkan 'autrjl'
            switch(feature.properties.autrjl) {
                case 1: return { color: "#e74c3c", weight: 3 };   // Jalan Arteri (Merah)
                case 2: return { color: "#f39c12", weight: 2 };   // Jalan Kolektor (Oranye)
                case 3: return { color: "#7f8c8d", weight: 1.2 }; // Jalan Lokal (Abu-abu)
                default: return { color: "#bdc3c7", weight: 1 };
            }
        }
    })
};

function initMap() {
    // Mematikan zoom control bawaan agar tidak bentrok dengan sidebar toggle
    map = L.map('map', { zoomControl: false }).setView(KANTOR_COORDS, 13);
    
    // Memindahkan kontrol zoom ke kanan atas
    L.control.zoom({ position: 'topright' }).addTo(map);

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');

    currentBasemap = osm; // Set default basemap

    markersLayer = L.layerGroup().addTo(map);

    const baseMaps = {
        "Peta OSM": osm,
        "Satelit": satellite
    };

    // Ikon Kantor
    const officeIcon = L.divIcon({
        html: '<i class="fas fa-briefcase icon-office"></i>',
        className: 'custom-div-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    L.marker(KANTOR_COORDS, {icon: officeIcon}).addTo(map).bindPopup("Kantor Saya");

    const overlays = {
        "Titik Kontrakan": markersLayer,
        "Jaringan Jalan": adminLayers.jalan,
        "Batas Desa": adminLayers.desa,
        "Batas Kecamatan": adminLayers.kecamatan,
        "Batas Kabupaten": adminLayers.kabupaten
    };

    L.control.layers(baseMaps, overlays, { collapsed: false }).addTo(map);

    // Auto-aktifkan layer batas wilayah saat web dibuka
    adminLayers.kabupaten.addTo(map);
    adminLayers.kecamatan.addTo(map);

    // Event listener untuk melacak perubahan basemap (untuk fitur transparansi)
    map.on('baselayerchange', function(e) {
        currentBasemap = e.layer;
        const opacityVal = document.getElementById('basemap-opacity').value;
        currentBasemap.setOpacity(opacityVal);
    });

    // Pemuatan data GeoJSON
    loadGeoJson('./data/jalan.geojson', adminLayers.jalan);
    loadGeoJson('./data/desa.geojson', adminLayers.desa);
    loadGeoJson('./data/kecamatan.geojson', adminLayers.kecamatan);
    loadGeoJson('./data/kabupaten.geojson', adminLayers.kabupaten);
    
    setupEventListeners();
    fetchData();
}

// ... [Fungsi fetchData, renderMarkers, showDetail, updateStatus, dan loadGeoJson TETAP SAMA seperti sebelumnya] ...
async function fetchData() {
    try {
        const response = await fetch(WEB_APP_URL);
        allData = await response.json();
        renderMarkers();
    } catch (e) {
        Swal.fire("Error", "Gagal mengambil data dari Google Sheets", "error");
    }
}

function renderMarkers() {
    markersLayer.clearLayers();
    const statusFilter = document.getElementById('filter-status').value;
    const hargaMax = parseInt(document.getElementById('filter-harga').value);
    const jarakMax = parseFloat(document.getElementById('filter-jarak').value);

    const houseIcon = L.divIcon({
        html: '<i class="fas fa-house-circle-check icon-house"></i>',
        className: 'custom-div-icon',
        iconSize: [25, 25],
        iconAnchor: [12, 12]
    });

    allData.forEach(item => {
        const lat = parseFloat(item.Lintang);
        const lng = parseFloat(item.Bujur);
        const hargaVal = parseInt(item.Harga.replace(/[^0-9]/g, '')) || 0;
        const jarak = map.distance([lat, lng], KANTOR_COORDS) / 1000;

        if ((statusFilter === "Semua" || item.Status === statusFilter) &&
            (hargaVal <= hargaMax) && (jarak <= jarakMax)) {
            
            L.marker([lat, lng], {icon: houseIcon})
                .addTo(markersLayer)
                .on('click', () => showDetail(item, jarak));
        }
    });
}

function showDetail(item, jarak) {
    Swal.fire({
        title: item.Lokasi,
        html: `
            <div class="text-start small">
                <p><strong>Harga:</strong> ${item.Harga} | <strong>Jarak:</strong> ${jarak.toFixed(2)} km</p>
                <p><strong>Spek:</strong><br>${item.Spesifikasi.replace(/\n/g, '<br>')}</p>
                <hr>
                <label class="fw-bold">Update Status:</label>
                <select id="update-status" class="form-select form-select-sm mt-1">
                    <option ${item.Status === 'Belum dikontak' ? 'selected' : ''}>Belum dikontak</option>
                    <option ${item.Status === 'Sudah kontak (available)' ? 'selected' : ''}>Sudah kontak (available)</option>
                    <option ${item.Status === 'Sudah kontak (belum available)' ? 'selected' : ''}>Sudah kontak (belum available)</option>
                    <option ${item.Status === 'Cek lokasi' ? 'selected' : ''}>Cek lokasi</option>
                    <option ${item.Status === 'Cek lokasi (kurang)' ? 'selected' : ''}>Cek lokasi (kurang)</option>
                    <option ${item.Status === 'Cek lokasi (recommended)' ? 'selected' : ''}>Cek lokasi (recommended)</option>
                </select>
                <button onclick="updateStatus('${item.No}')" class="btn btn-success btn-sm w-100 mt-2">Simpan Perubahan</button>
                <a href="${item.Link}" target="_blank" class="btn btn-primary btn-sm w-100 mt-1">Buka Instagram</a>
            </div>
        `,
        showConfirmButton: false
    });
}

async function updateStatus(no) {
    const newStatus = document.getElementById('update-status').value;
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const formData = new URLSearchParams();
        formData.append('no', no);
        formData.append('status', newStatus);

        // Fetch API dengan mode: 'no-cors'
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors', // <--- INI KUNCI UTAMANYA
            body: formData
        });
        
        // Dalam mode no-cors, browser mengunci response (opaque) sehingga kita 
        // tidak bisa membaca teks "Success" dari backend. Tapi request tetap tereksekusi.
        Swal.fire("Berhasil", "Status telah diperbarui di Spreadsheet!", "success");
        
        // Beri jeda 1 detik agar Google Sheets selesai menyimpan data sebelum kita tarik ulang
        setTimeout(() => {
            fetchData();
        }, 1000);

    } catch (e) {
        console.error(e);
        Swal.fire("Error", "Gagal update status. Pastikan koneksi internet stabil.", "error");
    }
}

async function loadGeoJson(url, layerGroup) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        layerGroup.addData(data);
    } catch (e) {
        console.warn(`Gagal memuat layer: ${url}. Pastikan file tersedia.`);
    }
}

function setupEventListeners() {
    // Tombol Toggle Sidebar
    document.getElementById('sidebarToggle').addEventListener('click', function() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('active');
        this.innerHTML = sidebar.classList.contains('active') ? '<i class="fas fa-times"></i>' : '<i class="fas fa-filter"></i>';
    });

    // Quick Price Filter
    document.querySelectorAll('.btn-quick-price').forEach(btn => {
        btn.addEventListener('click', function() {
            const val = this.getAttribute('data-value');
            const slider = document.getElementById('filter-harga');
            slider.value = val;
            document.getElementById('harga-val').innerText = val + " jt";
            renderMarkers();
        });
    });

    // Transparansi Basemap Event
    document.getElementById('basemap-opacity').addEventListener('input', function(e) {
        if(currentBasemap) {
            currentBasemap.setOpacity(e.target.value);
        }
    });

    // Filter lainnya
    document.getElementById('filter-status').onchange = renderMarkers;
    document.getElementById('filter-jarak').onchange = renderMarkers;
    document.getElementById('filter-harga').oninput = (e) => {
        document.getElementById('harga-val').innerText = e.target.value + " jt";
        renderMarkers();
    };
}

window.onload = initMap;