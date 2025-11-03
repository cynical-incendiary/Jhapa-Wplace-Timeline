<template>
    <div class="map-container">
        <div ref="map_container" class="map"></div>
        <div class="controls">
            <div class="time-display">{{ current_time_formatted }}</div>
            <div class="timeline">
                <button @click="go_previous" :disabled="selected_index === 0" class="nav-button prev-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <input type="range" :min="0" :max="time_strings.length - 1" v-model.number="selected_index"
                    @input="update_tile_opacity" class="timeline-slider" />
                <button @click="go_next" :disabled="selected_index === time_strings.length - 1"
                    class="nav-button next-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
            <div class="timeline-labels">
                <span>{{ times[0]?.toLocaleDateString() }}</span>
                <span>{{ times[times.length - 1]?.toLocaleDateString() }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const DAMAK_CENTER = [87.6750, 26.6656];
const TILE_BOUNDS = [
    [87.18758755927735, 26.902398802791005],
    [88.24209927802731, 26.902398802791005],
    [88.24209927802731, 26.431307064519423],
    [87.18758755927735, 26.431307064519423],
];

const time_strings = ["2025-11-02T02-49-27-039Z"];

const map_container = ref(null);
const map = ref(null);
const selected_index = ref(0);

const times = time_strings.map(slug =>
    new Date(slug.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z"))
);

const current_time_formatted = computed(() =>
    times[selected_index.value]?.toLocaleString(navigator.language, {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }) || "Unknown"
);

function go_previous() {
    if (selected_index.value > 0) {
        selected_index.value--;
        update_tile_opacity();
    }
}

function go_next() {
    if (selected_index.value < time_strings.length - 1) {
        selected_index.value++;
        update_tile_opacity();
    }
}

function create_tile_sources() {
    return Object.fromEntries(
        time_strings.map(slug => [
            `tiles-${slug}`,
            {
                type: "image",
                url: `/tiles/tile_backup_${slug}.png`,
                coordinates: TILE_BOUNDS,
            },
        ])
    );
}

function create_tile_layers() {
    return time_strings.map((slug, idx) => ({
        id: `tiles-${slug}`,
        type: "raster",
        source: `tiles-${slug}`,
        paint: {
            "raster-opacity": idx === 0 ? 1 : 0,
            "raster-resampling": "nearest",
        },
    }));
}

function update_tile_opacity() {
    if (!map.value?.isStyleLoaded()) return;

    time_strings.forEach((slug, idx) => {
        map.value.setPaintProperty(
            `tiles-${slug}`,
            "raster-opacity",
            idx === selected_index.value ? 1 : 0
        );
    });
}

onMounted(() => {
    map.value = new maplibregl.Map({
        container: map_container.value,
        style: {
            version: 8,
            sources: {
                "osm-tiles": {
                    type: "raster",
                    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                    tileSize: 256,
                    attribution: "© OpenStreetMap contributors",
                },
                ...create_tile_sources(),
            },
            layers: [
                { id: "background", type: "background", paint: { "background-color": "#1a1a1a" } },
                { id: "osm-base", type: "raster", source: "osm-tiles" },
                ...create_tile_layers(),
            ],
        },
        center: DAMAK_CENTER,
        zoom: 11,
        minZoom: 6,
        maxZoom: 18,
        maxBounds: [[86.5, 26.2], [88.4, 27.2]],
        renderWorldCopies: false,
    });

    map.value.on("load", () => {
        time_strings.forEach(slug => {
            map.value.setPaintProperty(`tiles-${slug}`, "raster-opacity", 1);
        });
    });

    map.value.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
});
</script>

<style scoped>
.map-container {
    position: relative;
    width: 100%;
    height: 100vh;
    background: #000;
}

.map {
    width: 100%;
    height: 100%;
}

.controls {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    padding: 20px;
    border-radius: 12px;
    min-width: 400px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.time-display {
    color: white;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 15px;
    text-align: center;
}

.timeline {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
}

.nav-button {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: white;
    cursor: pointer;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.nav-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
}

.nav-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.timeline-slider {
    flex: 1;
    border-radius: 3px;
    background: linear-gradient(to right, #fff3 0%, #fff6 100%);
    outline: none;
    cursor: pointer;
}

.timeline-slider::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.timeline-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.timeline-labels {
    display: flex;
    justify-content: space-between;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    margin-top: 8px;
}

@media (max-width: 480px) {
    .controls {
        width: 90%;
        min-width: auto;
        padding: 12px;
    }

    .time-display {
        font-size: 14px;
    }
}

:deep(.maplibregl-ctrl-group) {
    background: rgba(0, 0, 0, 0.8) !important;
    backdrop-filter: blur(10px);
    border-radius: 8px !important;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4) !important;
}

:deep(.maplibregl-ctrl-group button) {
    background: transparent !important;
    border: none !important;
}

:deep(.maplibregl-ctrl-icon) {
    filter: brightness(0) invert(1);
}

:deep(.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon),
:deep(.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon) {
    background-image: none !important;
}

:deep(.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon::before) {
    content: '+';
    color: white;
    font-size: 20px;
    font-weight: 300;
    display: block;
    text-align: center;
    line-height: 29px;
}

:deep(.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon::before) {
    content: '−';
    color: white;
    font-size: 20px;
    font-weight: 300;
    display: block;
    text-align: center;
    line-height: 29px;
}

:deep(.maplibregl-ctrl-group button:hover) {
    background: rgba(255, 255, 255, 0.1) !important;
}
</style>