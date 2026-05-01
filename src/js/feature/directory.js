import * as THREE from "three";
import { Navigation } from "@/js/events/navigation.js";
import { Floor } from "@/js/floor/floor.js";
import { clearStoredBottomSheet, showBottomSheet, hideBottomSheet } from "@/js/ui_ux/ui.js";
import { DirectoryMarker } from '@/js/marker/directorymarker.js';
import { animateCameraTo } from '@/js/ui_ux/animate.js';

let cachedFuntasiaData = null;

/* ── Color Maps ──────────────────────────────────────────── */

/** Zone → accent colors for icon bg, text, bar */
const zoneColorMap = {
  blue:   { bg: "bg-ctp-blue-50",   text: "text-ctp-blue",   bar: "bg-ctp-blue-500"  },
  green:  { bg: "bg-ctp-green-50",  text: "text-ctp-green",  bar: "bg-ctp-green-500" },
  orange: { bg: "bg-orange-50",     text: "text-orange-600", bar: "bg-orange-500"    },
  purple: { bg: "bg-ctp-mauve-50",  text: "text-ctp-mauve",  bar: "bg-ctp-mauve-500" },
  red:    { bg: "bg-ctp-red-50",    text: "text-ctp-red",    bar: "bg-ctp-red-500"   },
  yellow: { bg: "bg-yellow-50",     text: "text-yellow-600", bar: "bg-yellow-500"    },
  brown:  { bg: "bg-amber-50",      text: "text-amber-800",  bar: "bg-amber-600"     },
};

/** Tag → pill/chip hex color */
const tagColorMap = {
  Game:        "var(--color-ctp-blue)",
  Performance: "var(--color-ctp-mauve)", 
  Academic:    "var(--color-ctp-teal)",
  Food:        "var(--color-ctp-maroon)", 
  Drinks:      "var(--color-ctp-sky)",
  Merch:       "var(--color-ctp-peach)", 
  Photos:      "var(--color-ctp-pink)",
  Info:        "var(--color-ctp-sapphire)",
  Tickets:     "var(--color-ctp-flamingo)",
  Services:    "var(--color-ctp-green)",
  CCA:         "var(--color-ctp-lavender)",
  "First Aid": "var(--color-ctp-red)",
  "Glam Up":   "var(--color-ctp-rosewater)"
};

const fallbackTagColor = "#6b7280"; // gray-500

/* ── Filter State ────────────────────────────────────────── */

const filterState = {
  search: "",
  level: "",      // "" = all
  zone: "",       // "" = all
  tags: new Set() // multi-select
};

/* ── Data Fetching ───────────────────────────────────────── */

export async function fetchDirectoryData() {
  try {
    // const response = await fetch(`${ASSETS_BASE_URL}/json_data/funtasia_data.json`);
    // const rawData = await response.json();
    const localData = await import("@/assets/funtasia_data.json");
    const rawData = localData.default;
    // console.log(rawData);
    
    // Normalize data: convert array format to object format keyed by "Booth ID"
    // This ensures compatibility whether the CDN serves the old array or new object format.
    const normalizedData = {};
    for (const [level, items] of Object.entries(rawData)) {
      if (Array.isArray(items)) {
        normalizedData[level] = {};
        items.forEach(item => {
          if (item["Booth ID"]) {
            normalizedData[level][item["Booth ID"]] = item;
          }
        });
      } else {
        normalizedData[level] = items;
      }
    }
    
    return normalizedData;
  } catch (e) {
    console.error("Failed to fetch directory data:", e);
    throw e;
  }
}

export function setDirectoryData(processedData) {
  cachedFuntasiaData = processedData;
  const container = document.getElementById("funtasia-directory-list");
  if (container) {
    // Re-populate tags and re-render with the latest processed data
    populateTagChips(cachedFuntasiaData);
    applyFilters();
  }
}

export function getDirectoryData() {
  return cachedFuntasiaData;
}

/* ── Tag Helpers ─────────────────────────────────────────── */

/** Normalise Tags field (string | string[] | empty) into a clean array */
function parseTags(rawTags) {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) return rawTags.map(t => t.trim()).filter(Boolean);
  return rawTags.split(",").map(t => t.trim()).filter(Boolean);
}

/** Collect every unique tag from the full dataset */
function collectAllTags(funtasiaData) {
  const tags = new Set();
  const levels = Object.keys(funtasiaData);
  levels.forEach(level => {
    if (typeof funtasiaData[level] !== 'object' || funtasiaData[level] === null) return;
    Object.values(funtasiaData[level]).forEach(item => {
      parseTags(item["tags"] || item["Tags"]).forEach(t => tags.add(t));
    });
  });
  return [...tags].sort();
}

/* ── Zone Color Helper ───────────────────────────────────── */

function getZoneColors(zoneName) {
  if (!zoneName) return { bg: "bg-ctp-surface1", text: "text-ctp-text", bar: "bg-ctp-surface0" };
  const lower = zoneName.toLowerCase();
  for (const [key, colors] of Object.entries(zoneColorMap)) {
    if (lower.includes(key)) return colors;
  }
  return { bg: "bg-ctp-surface1", text: "text-ctp-text", bar: "color-ctp-mauve" };
}

/* ── Filtering ───────────────────────────────────────────── */

/**
 * Returns a flat array of { item, level } objects that pass all active filters.
 * Filters are AND-ed: level ∩ zone ∩ tags ∩ search.
 * Tags use OR within themselves (item matches if it has ANY selected tag).
 */
function getFilteredData(funtasiaData) {
  const results = [];
  const levelsToSearch = filterState.level
    ? [filterState.level]
    : Object.keys(funtasiaData);

  levelsToSearch.forEach(level => {
    if (typeof funtasiaData[level] !== 'object' || funtasiaData[level] === null) return;
    Object.entries(funtasiaData[level]).forEach(([boothId, item]) => {
      // Zone filter
      if (filterState.zone) {
        const itemZone = (item["zone"] || item["Zone"] || "").trim();
        if (itemZone.toLowerCase() !== filterState.zone.toLowerCase()) return;
      }

      // Tag filter (OR: item must have at least one selected tag)
      if (filterState.tags.size > 0) {
        const itemTags = parseTags(item["tags"] || item["Tags"]);
        const hasMatch = itemTags.some(t => filterState.tags.has(t));
        if (!hasMatch) return;
      }

      // Search filter (Tokenized for multi-word support)
      if (filterState.search) {
        const tokens = filterState.search.toLowerCase().trim().split(/\s+/);
        
        const itemTagsRaw = item["tags"] || item["Tags"] || "";
        const itemTagsStr = Array.isArray(itemTagsRaw) ? itemTagsRaw.join(" ") : String(itemTagsRaw);
        
        const invisibleTags = item["invis_tags"] || item["invis_tag"] || item["Invisible Tags"] || "";
        const invisibleTagsStr = Array.isArray(invisibleTags) ? invisibleTags.join(" ") : String(invisibleTags);

        const keywords = item["Keywords"] || "";
        const keywordsStr = Array.isArray(keywords) ? keywords.join(" ") : String(keywords);

        const haystack = [
          item["booth_name"] || item["Booth Name"] || "",
          item["booth_description"] || item["Booth Description"] || "",
          itemTagsStr,
          invisibleTagsStr,
          keywordsStr,
          boothId || ""
        ].join(" ").toLowerCase();

        const allMatch = tokens.every(token => haystack.includes(token));
        if (!allMatch) return;
      }

      // We inject Booth ID here for rendering later
      results.push({ item: { ...item, "Booth ID": boothId }, level });
    });
  });

  return results;
}

/**
 * Orchestrates navigation, marker placement, and camera focus for a specific booth.
 * Can be called from the directory, event schedule, or external links.
 */
export async function focusOnBooth(boothNum, levelHint = null) {
  if (!cachedFuntasiaData || !appStateRef) return;

  let level = levelHint;
  let item = null;

  // Find the item and its level in the cached data
  if (level && cachedFuntasiaData[level] && cachedFuntasiaData[level][boothNum]) {
    item = cachedFuntasiaData[level][boothNum];
  } else {
    // Search all levels if hint is missing or incorrect
    for (const l of Object.keys(cachedFuntasiaData)) {
      if (cachedFuntasiaData[l] && cachedFuntasiaData[l][boothNum]) {
        item = cachedFuntasiaData[l][boothNum];
        level = l;
        break;
      }
    }
  }

  if (!item || !level) {
    console.warn(`Booth ${boothNum} not found in directory data.`);
    return;
  }

  const boothName = item["booth_name"] || item["Booth Name"] || boothNum;
  const boothDesc = item["booth_description"] || item["Booth Description"] || "No description available.";

  // 1. Navigation Logic
  let targetFloorId = level;
  const children = Floor.childModels[level] || {};
  
  // Try exact match first (e.g. if booth name is "Canteen")
  if (children[boothName]) {
    targetFloorId = children[boothName];
  } else {
    // Check if booth ID starts with child ID (ish -> ISH1) or node name prefix (C -> Canteen)
    for (const [nodeName, childId] of Object.entries(children)) {
        if (boothNum.toLowerCase().startsWith(childId.toLowerCase()) || 
            (nodeName.length > 0 && boothNum.toLowerCase().startsWith(nodeName[0].toLowerCase()))) {
          targetFloorId = childId;
          break;
        }
    }
  }

  await Navigation.switchFloor(targetFloorId);
  clearStoredBottomSheet();
  hideBottomSheet();

  // 2. Clear previous markers
  if (appStateRef.activeDirectoryMarker) {
    appStateRef.activeDirectoryMarker.clear();
    appStateRef.activeDirectoryMarker = null;
  }
  
  appStateRef.activeDirectoryBoothId = boothNum;
  appStateRef.activeDirectoryLevel = level;
  appStateRef.activeDirectoryActualFloor = targetFloorId;

  // 3. Marker and Camera Logic
  // Re-fetch to ensure we have any runtime-injected data (like Location coordinates)
  const latestItem = cachedFuntasiaData[level][boothNum] || item;
  const locationData = latestItem["location"] || latestItem["Location"];

  if (locationData) {
    const marker = new DirectoryMarker(locationData, targetFloorId);
    appStateRef.activeDirectoryMarker = marker;
    appStateRef.activeMarkers.push(marker);

    // Camera animation setup
    const objectCenter = latestItem["Location"].clone().add(new THREE.Vector3(0, 1, 0));
    const camPos = appStateRef.camera.position.clone();
    const controlsTarget = appStateRef.controls.target.clone();

    const direction = new THREE.Vector3().subVectors(camPos, controlsTarget);
    direction.y = 0;
    if (direction.lengthSq() < 0.001) direction.set(0, 0, 1);
    direction.normalize();

    // Cardinal snapping
    if (Math.abs(direction.x) > Math.abs(direction.z)) {
      direction.set(Math.sign(direction.x), 0, 0);
    } else {
      direction.set(0, 0, Math.sign(direction.z));
    }

    const markerBaseScale = 5;
    const distance = markerBaseScale * (appStateRef.cameraAnim.viewDistanceFactor || 1.2);
    const heightOffset = markerBaseScale * (appStateRef.cameraAnim.viewHeightFactor || 0.8);
    const newCamPos = objectCenter.clone()
      .add(direction.multiplyScalar(distance))
      .add(new THREE.Vector3(0, heightOffset, 0));

    animateCameraTo(appStateRef, newCamPos, objectCenter);
  }

  // 4. Interaction messaging
  window.parent.postMessage({ type: 'selectPOI', id: boothNum, floor: level }, '*');

  // 5. UI Cleanup/Update

  // Update the global state so showFabButtons knows the marker UI is active
  if (typeof window.setClearDirectoryMarkerVisible === 'function') {
    window.setClearDirectoryMarkerVisible(true);
  }

  document.querySelectorAll(".modal-wrapper").forEach(mod_wrapp => {
    mod_wrapp.style.display = 'none';
  });

  if (typeof window.showFabButtons === 'function') {
    window.showFabButtons();
  }

  showBottomSheet(boothName, null, boothDesc);
}

/* ── Rendering ───────────────────────────────────────────── */

function renderDirectory(container, funtasiaData) {
  container.innerHTML = "";

  const filtered = getFilteredData(funtasiaData);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-center px-6">
        <span class="material-symbols-outlined text-[40px] text-ctp-subtext1 mb-3">search_off</span>
        <p class="font-headline font-bold text-ctp-text text-sm">No results found</p>
        <p class="text-ctp-subtext1 text-xs mt-1">Try adjusting your filters or search term</p>
      </div>`;
    return;
  }

  // Group by level, then by zone
  const grouped = {};
  filtered.forEach(({ item, level }) => {
    if (!grouped[level]) grouped[level] = {};
    let zone = item["zone"] || item["Zone"];
    if (!zone || zone.trim() === "-") zone = "Other Zones";
    else zone = zone.trim();
    if (!grouped[level][zone]) grouped[level][zone] = [];
    grouped[level][zone].push(item);
  });

  const levelOrder = ["b3", "b2", "b1", "l1", "l2", "l3"];
  const sortedLevels = Object.keys(grouped).sort(
    (a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b)
  );

  sortedLevels.forEach(level => {
    const levelSection = document.createElement("div");
    levelSection.className = "mb-8";

    const levelHeader = document.createElement("h3");
    levelHeader.className = "modal-section-title text-primary";
    levelHeader.textContent = level;
    levelSection.appendChild(levelHeader);

    for (const [zone, items] of Object.entries(grouped[level])) {
      const zoneBlock = document.createElement("div");
      zoneBlock.className = "mb-6 last:mb-0";
      const zoneColors = getZoneColors(zone);

      const zoneHeader = document.createElement("h4");
      zoneHeader.className = `text-xs font-bold tracking-[0.1em] uppercase px-4 mb-3 ${zoneColors.text}`;
      zoneHeader.textContent = zone;
      zoneBlock.appendChild(zoneHeader);

      const itemsContainer = document.createElement("div");
      itemsContainer.className = "space-y-2";

      items.forEach(item => {
        const itemEl = document.createElement("div");
        itemEl.className = "modal-list-item";

        let boothName = item["booth_name"] || item["Booth Name"] || "Unnamed Booth";
        if (boothName === "-") boothName = "Unnamed Booth";
        const boothDesc = item["booth_description"] || item["Booth Description"] || "No description available.";
        const boothNum = item["Booth ID"];
        const itemTags = parseTags(item["tags"] || item["Tags"]);

        // Build tag pills HTML
        const tagPillsHTML = itemTags.map(tag => {
          const color = tagColorMap[tag] || fallbackTagColor;
          return `<span class="tag-pill" style="--pill-color: ${color};">${tag}</span>`;
        }).join("");

        itemEl.onclick = () => focusOnBooth(boothNum, level);

        itemEl.innerHTML = `
          <div class="modal-item-icon-wrapper ${zoneColors.bg} ${zoneColors.text}">
            <span class="material-symbols-outlined text-[20px]" data-icon="festival">festival</span>
          </div>
          <div class="modal-item-accent-bar ${zoneColors.bar}"></div>
          <div class="modal-item-content">
            <div class="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 class="modal-item-title leading-tight">${boothName}</h3>
              ${tagPillsHTML}
            </div>
            <p class="modal-item-subtitle mt-0.5 opacity-80 line-clamp-2">${boothDesc}</p>
          </div>
          <span class="modal-item-chevron">chevron_right</span>
        `;
        itemsContainer.appendChild(itemEl);
      });

      zoneBlock.appendChild(itemsContainer);
      levelSection.appendChild(zoneBlock);
    }

    container.appendChild(levelSection);
  });
}

/* ── Tag Chip Population ─────────────────────────────────── */

function populateTagChips(funtasiaData) {
  const tagsContainer = document.getElementById("filter-tags-container");
  if (!tagsContainer) return;

  tagsContainer.innerHTML = "";
  const allTags = collectAllTags(funtasiaData);

  allTags.forEach(tag => {
    const chip = document.createElement("button");
    chip.className = "filter-chip";
    chip.textContent = tag;
    const color = tagColorMap[tag] || fallbackTagColor;
    chip.style.setProperty("--chip-color", color);

    if (filterState.tags.has(tag)) chip.classList.add("active");

    chip.addEventListener("click", () => {
      if (filterState.tags.has(tag)) {
        filterState.tags.delete(tag);
        chip.classList.remove("active");
      } else {
        filterState.tags.add(tag);
        chip.classList.add("active");
      }
      applyFilters();
    });

    tagsContainer.appendChild(chip);
  });
}

/* ── Filter Application ──────────────────────────────────── */

function applyFilters() {
  const container = document.getElementById("funtasia-directory-list");
  if (!container || !cachedFuntasiaData) return;
  renderDirectory(container, cachedFuntasiaData);
}

/* ── Filter Event Binding ────────────────────────────────── */

function bindFilterEvents() {
  // Search
  const searchInput = document.getElementById("directory-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      filterState.search = e.target.value;
      applyFilters();
    });
  }

  // Level dropdown
  const levelSelect = document.getElementById("filter-level");
  if (levelSelect) {
    levelSelect.addEventListener("change", (e) => {
      filterState.level = e.target.value;
      applyFilters();
    });
  }

  // Zone dropdown
  const zoneSelect = document.getElementById("filter-zone");
  if (zoneSelect) {
    zoneSelect.addEventListener("change", (e) => {
      filterState.zone = e.target.value;
      applyFilters();
    });
  }

  // Clear All
  const clearBtn = document.getElementById("filter-clear-all-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      filterState.search = "";
      filterState.level = "";
      filterState.zone = "";
      filterState.tags.clear();

      // Reset UI controls
      if (searchInput) searchInput.value = "";
      if (levelSelect) levelSelect.value = "";
      if (zoneSelect) zoneSelect.value = "";

      // Reset tag chips
      document.querySelectorAll("#filter-tags-container .filter-chip").forEach(chip => {
        chip.classList.remove("active");
      });

      applyFilters();
    });
  }
}

/* ── Public Init ─────────────────────────────────────────── */

let appStateRef = null;

export function initDirectory(appState) {
  appStateRef = appState;
  const container = document.getElementById("funtasia-directory-list");
  if (!container) return;

  bindFilterEvents();

  if (cachedFuntasiaData) {
    populateTagChips(cachedFuntasiaData);
    renderDirectory(container, cachedFuntasiaData);
  } else {
    container.innerHTML = "Loading directory data..."; 
  }
}
