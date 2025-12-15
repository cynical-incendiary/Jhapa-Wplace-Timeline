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
                <input type="range" :min="0" :max="TIME_STRINGS.length - 1" v-model.number="selected_index"
                    class="timeline-slider" />
                <button @click="go_next" :disabled="selected_index === TIME_STRINGS.length - 1"
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
import { ref, computed, onMounted, watch } from "vue";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import {
    TIME_STRINGS,
    QUADRANT_COORDS,
    QUADS,
    MIN_LON,
    MAX_LON,
    MIN_LAT,
    MAX_LAT
} from "../map-config-generated";

const DAMAK_CENTER = [87.6750, 26.6656];

const map_container = ref(null);
const map = ref(null);
const selected_index = ref(0);

const previous_index = ref(null);
const is_map_ready = ref(false);
let debounce_timer = null;

const times = TIME_STRINGS.map(slug =>
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
    }
}

function go_next() {
    if (selected_index.value < TIME_STRINGS.length - 1) {
        selected_index.value++;
    }
}

function add_tiles_for_timestep(slug) {
    if (!map.value) return;

    for (const quad of QUADS) {
        const source_id = `tiles-${slug}-${quad}`;
        const layer_id = source_id;

        if (!map.value.getSource(source_id)) {
            map.value.addSource(source_id, {
                type: "image",
                url: `${import.meta.env.BASE_URL}tiles/tile_backup_${slug}_${quad}.png`,
                coordinates: QUADRANT_COORDS[quad],
            });

            map.value.addLayer({
                id: layer_id,
                type: "raster",
                source: source_id,
                paint: {
                    "raster-opacity": 1, // Start visible
                    "raster-resampling": "nearest",
                },
            });
        } else {
            map.value.setPaintProperty(layer_id, "raster-opacity", 1);
        }
    }
}

function remove_tiles_for_timestep(slug) {
    if (!map.value) return;

    for (const quad of QUADS) {
        const source_id = `tiles-${slug}-${quad}`;
        const layer_id = source_id;

        if (map.value.getLayer(layer_id)) {
            map.value.removeLayer(layer_id);
        }
        if (map.value.getSource(source_id)) {
            map.value.removeSource(source_id);
        }
    }
}


function update_map_tiles() {
    if (!is_map_ready.value || !map.value) return;

    const current_slug = TIME_STRINGS[selected_index.value];

    const style = map.value.getStyle();
    if (style && style.layers) {
        const layers_to_remove = style.layers
            .filter(l => l.id.startsWith("tiles-") && !l.id.includes(current_slug))
            .map(l => l.id);

        layers_to_remove.forEach(layer_id => {
            if (map.value.getLayer(layer_id)) {
                map.value.removeLayer(layer_id);
            }
            if (map.value.getSource(layer_id)) {
                map.value.removeSource(layer_id);
            }
        });
    }

    add_tiles_for_timestep(current_slug);

    previous_index.value = selected_index.value;
}

watch(selected_index, () => {
    if (is_map_ready.value) {
        clearTimeout(debounce_timer);
        debounce_timer = setTimeout(() => {
            update_map_tiles();
        }, 150);
    }
});

onMounted(() => {
    map.value = new maplibregl.Map({
        container: map_container.value,
        style: {
            version: 8,
            sources: {
                "osm-tiles": {
                    type: "raster",
                    tiles: ["https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"],
                    tileSize: 256,
                    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
                },
            },
            layers: [
                { id: "background", type: "background", paint: { "background-color": "#f8f4f0" } },
                { id: "osm-base", type: "raster", source: "osm-tiles" },
            ],
        },
        center: DAMAK_CENTER,
        zoom: 11,
        minZoom: 6,
        maxZoom: 18,
        maxBounds: [[MIN_LON, MIN_LAT], [MAX_LON, MAX_LAT]],
        renderWorldCopies: false,
        dragRotate: false,
        touchRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
    });

    map.value.touchZoomRotate.disableRotation();
    map.value.dragRotate.disable();
    map.value.touchPitch.disable();

    map.value.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.value.on("load", () => {
        is_map_ready.value = true;
        update_map_tiles();
    });
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
    z-index: 10;
    /* Ensure controls are above the map */
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
