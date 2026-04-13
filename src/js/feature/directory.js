import funtasiaData from "@/assets/funtasia_data.json";
import { Navigation } from "@/js/events/navigation.js";
import { hideBottomSheet } from "@/js/ui_ux/ui.js";

export function initDirectory() {
  const container = document.getElementById("funtasia-directory-list");
  if (!container) return;

  container.innerHTML = ""; // Clear placeholders

  const getZoneColors = (zoneName) => {
    if (!zoneName) return { bg: "bg-gray-50", text: "text-gray-600", bar: "bg-gray-500" };
    const lower = zoneName.toLowerCase();
    if (lower.includes("blue")) return { bg: "bg-blue-50", text: "text-blue-600", bar: "bg-blue-500" };
    if (lower.includes("green")) return { bg: "bg-green-50", text: "text-green-600", bar: "bg-green-500" };
    if (lower.includes("orange")) return { bg: "bg-orange-50", text: "text-orange-600", bar: "bg-orange-500" };
    if (lower.includes("purple")) return { bg: "bg-purple-50", text: "text-purple-600", bar: "bg-purple-500" };
    if (lower.includes("red")) return { bg: "bg-red-50", text: "text-red-600", bar: "bg-red-500" };
    if (lower.includes("yellow")) return { bg: "bg-yellow-50", text: "text-yellow-600", bar: "bg-yellow-500" };
    if (lower.includes("brown") || lower.includes("amber")) return { bg: "bg-amber-50", text: "text-amber-800", bar: "bg-amber-600" }; // Using amber instead of brown as tailwind brown is not standard
    return { bg: "bg-surface-variant", text: "text-on-surface-variant", bar: "bg-outline" };
  };

  const levels = ["l1", "l2", "l3"];
  
  levels.forEach(level => {
    if (!funtasiaData[level] || funtasiaData[level].length === 0) return;

    // Create Level Segment
    const levelSection = document.createElement("div");
    levelSection.className = "mb-8";
    
    // Level Header
    const levelHeader = document.createElement("h3");
    levelHeader.className = "font-headline font-extrabold text-xl text-primary mb-4 px-4 tracking-tight border-b-2 border-primary/20 pb-2";
    levelHeader.textContent = `Level ${level.replace("l", "")}`;
    levelSection.appendChild(levelHeader);

    // Group items by Zone
    const groupedByZone = {};
    funtasiaData[level].forEach(item => {
      let zone = item["Zone"];
      if (!zone || zone.trim() === "-") zone = "Other Zones";
      else zone = zone.trim();
      
      if (!groupedByZone[zone]) groupedByZone[zone] = [];
      groupedByZone[zone].push(item);
    });

    // Generate Zone Blocks
    for (const [zone, items] of Object.entries(groupedByZone)) {
      const zoneBlock = document.createElement("div");
      zoneBlock.className = "mb-6 last:mb-0";
      
      const zoneColors = getZoneColors(zone);

      // Zone Header
      const zoneHeader = document.createElement("h4");
      zoneHeader.className = `text-xs font-bold tracking-[0.1em] uppercase px-4 mb-3 ${zoneColors.text}`;
      zoneHeader.textContent = zone;
      zoneBlock.appendChild(zoneHeader);

      const itemsContainer = document.createElement("div");
      itemsContainer.className = "space-y-2";

      // Items
      items.forEach(item => {
        const itemEl = document.createElement("div");
        itemEl.className = "modal-list-item";
        
        let boothName = item["Booth Name"] || "Unnamed Booth";
        if (boothName === "-") boothName = "Unnamed Booth";
        const boothDesc = item["Booth Description"] || "No description available.";
        const boothNum = item["Booth Number"];

        itemEl.onclick = () => {
          // Switch to the correct floor
          Navigation.switchFloor(level);
          
          // Ensure bottomsheet is hidden or show loading...
          hideBottomSheet();

          // Fire selection event tracking for potential postMessage architecture
          window.parent.postMessage({ type: 'selectPOI', id: boothNum, floor: level }, '*');

          // Close the directory modal
          const dirModalOuter = document.getElementById("directory-modal-wrapper");
          if(dirModalOuter) dirModalOuter.style.display = 'none';
          
          // Make sure fab buttons reappear
          const openDirBtn = document.getElementById('open-directory-btn');
          const openSettingsBtn = document.getElementById('open-settings-btn');
          if(openDirBtn) openDirBtn.style.display = 'flex';
          if(openSettingsBtn) openSettingsBtn.style.display = 'flex';
        };

        itemEl.innerHTML = `
          <div class="modal-item-icon-wrapper ${zoneColors.bg} ${zoneColors.text}">
            <span class="material-symbols-outlined text-[20px]" data-icon="festival">festival</span>
          </div>
          <div class="modal-item-accent-bar ${zoneColors.bar}"></div>
          <div class="modal-item-content">
            <h3 class="modal-item-title leading-tight">${boothNum ? `${boothNum}: ` : ''}${boothName}</h3>
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
