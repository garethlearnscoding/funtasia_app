const sheet = document.getElementById("bottom-sheet");
const sheetTitle = document.getElementById("sheet-title");
const sheetDesc = document.getElementById("sheet-desc");
const closeBtn = document.getElementById("close-btn");
import { Navigation } from "@/js/base/navigation.js";

const locationData = {}; // Placeholder

function getLocationInfo(objectName) {
  if (locationData[objectName]) {
    return locationData[objectName];
  }
  return {
    title: objectName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    description: `This is ${objectName.replace(
      /_/g,
      " ",
    )}. Click to learn more about this location.`,
  };
}

export function showBottomSheet(objectName) {
  const locationInfo = getLocationInfo(objectName);
  sheetTitle.textContent = locationInfo.title;
  sheetDesc.textContent = locationInfo.description;
  sheet.classList.add("show");
}

export function hideBottomSheet() {
  sheet.classList.remove("show");
}

export function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast-popup");
  const toastMsg = document.getElementById("toast-message");
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.add("show");

  // Remove any existing timeout to reset the timer if called repeatedly
  if (toast.hideTimeout) clearTimeout(toast.hideTimeout);

  toast.hideTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

export function setupUI(floors) {
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    hideBottomSheet();
  });

  closeBtn.addEventListener("touchend", (e) => {
    e.stopPropagation();
    e.preventDefault();
    hideBottomSheet();
  });

  const floorSelector = document.getElementById("floor-selector");
  const floorThumb = document.getElementById("floor-thumb");
  const floorBtns = Array.from(document.querySelectorAll(".floor-btn"));

  if (floorSelector && floorThumb && floorBtns.length > 0) {
    let isDragging = false;
    let activeIndex = 3; // Default to 'L1' which is at index 3 in the DOM
    
    function getCSSPadding() {
      return window.innerWidth <= 768 ? 6 : 8;
    }

    function updateThumbUI(index) {
      if (index < 0) index = 0;
      if (index >= floorBtns.length) index = floorBtns.length - 1;
      const buttonHeight = floorBtns[0].offsetHeight || 40;
      const gap = 4;
      const newTop = getCSSPadding() + (index * (buttonHeight + gap));
      floorThumb.style.top = `${newTop}px`;
    }

    // Set initial position
    updateThumbUI(activeIndex);

    function processInteraction(clientY) {
      const rect = floorSelector.getBoundingClientRect();
      const relativeY = clientY - rect.top;
      
      const buttonHeight = floorBtns[0].offsetHeight || 40;
      const step = buttonHeight + 4; // button height + gap
      const offsetToCenter = getCSSPadding() + (buttonHeight / 2);
      
      let index = Math.round((relativeY - offsetToCenter) / step);
      if (index < 0) index = 0;
      if (index >= floorBtns.length) index = floorBtns.length - 1;
      
      if (index !== activeIndex) {
        activeIndex = index;
        updateThumbUI(index);
        
        const floorId = floorBtns[index].dataset.floor;
        if (floors[floorId] && floors[floorId].isLoaded()) {
           Navigation.switchFloor(floorId);
        }
      }
    }

    floorSelector.addEventListener("pointerdown", (e) => {
      isDragging = true;
      floorSelector.setPointerCapture(e.pointerId);
      processInteraction(e.clientY);
      e.preventDefault();
      e.stopPropagation();
    });

    floorSelector.addEventListener("pointermove", (e) => {
      if (isDragging) {
        processInteraction(e.clientY);
        e.preventDefault();
        e.stopPropagation();
      }
    });

    floorSelector.addEventListener("pointerup", (e) => {
      if (isDragging) {
        isDragging = false;
        floorSelector.releasePointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
      }
    });
    
    floorSelector.addEventListener("pointercancel", (e) => {
        isDragging = false;
        try { floorSelector.releasePointerCapture(e.pointerId); } catch(err) {}
    });
  }
}


