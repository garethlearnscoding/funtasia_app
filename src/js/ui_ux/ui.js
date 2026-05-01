import { focusOnFloor } from "@/js/ui_ux/cameraUtils.js";

const sheet = document.getElementById("bottom-sheet");
const sheetTitle = document.getElementById("sheet-title");
const sheetDesc = document.getElementById("sheet-desc");
const closeBtn = document.getElementById("close-btn");
/** @type {Object.<string, {title: string, description: string}>} */
const locationData = {}; 

/**
 * Populates the UI's location database from the directory JSON.
 * @param {Object} data - The directory data object { floor: { boothId: item } }
 */
export function setDirectoryData(data) {
  if (!data || typeof data !== 'object') return;

  // Flatten the floor-grouped data for the UI lookup map
  Object.values(data).forEach(floorEntries => {
    if (!floorEntries || typeof floorEntries !== 'object') return;

    Object.entries(floorEntries).forEach(([id, item]) => {
      const title = item["Booth Name"] || item["booth_name"] || id;
      const description = item["Booth Description"] || item["booth_description"];

      const info = {
        title: title,
        description: description || `Welcome to ${title}.`
      };

      // Map by ID and by Title to ensure showBottomSheet always finds the data
      locationData[id] = info;
      if (title !== id) {
        locationData[title] = info;
      }
    });
  });
}

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

let currentAppState = null;
let storedBottomSheetState = null;

export function showBottomSheet(objectName, childFloorId = null, description = null, title = null) {
  // Store the current state so it can be restored later
  storedBottomSheetState = { objectName, childFloorId, description, title };
  const locationInfo = getLocationInfo(objectName);
  sheetTitle.textContent = title || locationInfo.title;
  sheetDesc.textContent = description ? description : locationInfo.description;
  
  const enterBtn = document.getElementById("enter-child-btn");
  const lt5Btn = document.getElementById("lt5-event-btn");
  const o2Btn = document.getElementById("o2-event-btn");

  if (enterBtn) {
    if (childFloorId) {
      enterBtn.style.display = "block";
      enterBtn.onclick = async () => {
        const { Navigation } = await import("@/js/events/navigation.js");
        Navigation.switchFloor(childFloorId);
        hideBottomSheet();
      };
    } else {
      enterBtn.style.display = "none";
      enterBtn.onclick = null;
    }
  }

  if (lt5Btn) {
    if (objectName === "LT5") {
      lt5Btn.style.display = "block";
      lt5Btn.onclick = () => {
        if (window.openEventsModal) window.openEventsModal("cca");
        hideBottomSheet();
      };
    } else {
      lt5Btn.style.display = "none";
      lt5Btn.onclick = null;
    }
  }

  if (o2Btn) {
    if (objectName === "O2") {
      o2Btn.style.display = "block";
      o2Btn.onclick = () => {
        if (window.openEventsModal) window.openEventsModal("pabusking");
        hideBottomSheet();
      };
    } else {
      o2Btn.style.display = "none";
      o2Btn.onclick = null;
    }
  }

  sheet.classList.add("show");
  if (currentAppState) currentAppState.isBottomSheetOpen = true;
}

export function hideBottomSheet(clearState = true) {
  sheet.classList.remove("show");
  if (currentAppState) {
    currentAppState.isBottomSheetOpen = false;
  }
  if (clearState) {
    storedBottomSheetState = null;
  }
  window.dispatchEvent(new Event('bottomsheetclose'));
}

export function storeAndHideBottomSheet() {
  if (currentAppState && currentAppState.isBottomSheetOpen) {
    // Hide without clearing the stored state
    hideBottomSheet(false);
  } else {
    // If it wasn't open, ensure no stale state is stored
    storedBottomSheetState = null;
  }
}

export function reopenStoredBottomSheet() {
  if (storedBottomSheetState) {
    const { objectName, childFloorId, description, title } = storedBottomSheetState;
    showBottomSheet(objectName, childFloorId, description, title);
  }
}

export function clearStoredBottomSheet() {
  storedBottomSheetState = null;
}

export function hideToast() {
  const toast = document.getElementById("toast-popup");
  if (!toast) return;
  toast.classList.remove("show");
  if (toast.hideTimeout) {
    clearTimeout(toast.hideTimeout);
    toast.hideTimeout = null;
  }
}

export function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast-popup");
  const toastMsg = document.getElementById("toast-message");
  if (!toast || !toastMsg) return;

  hideToast(); // Clear any existing toast before showing new one

  toastMsg.textContent = message;
  toast.classList.add("show");

  toast.hideTimeout = setTimeout(() => {
    toast.classList.remove("show");
    toast.hideTimeout = null;
  }, duration);
}

let floorSelector = null;
let floorThumb = null;
let floorBtns = [];
let activeIndex = -1;

export function updateFloorUI(floorId) {
  if (!floorThumb || floorBtns.length === 0) {
    // Retry finding elements if they aren't captured yet
    floorSelector = document.getElementById("floor-selector");
    floorThumb = document.getElementById("floor-thumb");
    floorBtns = Array.from(document.querySelectorAll(".floor-btn"));
    if (!floorThumb || floorBtns.length === 0) return;
  }

  const index = floorBtns.findIndex(btn => btn.dataset.floor === floorId);
  if (index === -1) return;

  activeIndex = index;
  
  // Update button classes
  floorBtns.forEach((btn, i) => {
    btn.classList.toggle("active", i === index);
  });

  // Update thumb position
  const buttonHeight = floorBtns[0].offsetHeight || (window.innerWidth <= 768 ? 36 : 40);
  const gap = 4;
  const padding = window.innerWidth <= 768 ? 6 : 8;
  const newTop = padding + (index * (buttonHeight + gap));
  
  floorThumb.style.top = `${newTop}px`;
  floorThumb.style.opacity = "1";
}

export function setupUI(floors, appState) {
  currentAppState = appState;
  
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


  floorSelector = document.getElementById("floor-selector");
  floorThumb = document.getElementById("floor-thumb");
  floorBtns = Array.from(document.querySelectorAll(".floor-btn"));


  if (floorSelector && floorThumb && floorBtns.length > 0) {
    let isDragging = false;
    
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
      floorThumb.style.opacity = "1";
    }

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
        const NavigationPromise = import("@/js/events/navigation.js");
        NavigationPromise.then(({ Navigation }) => {
          Navigation.switchFloor(floorId);
        });
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

  // --- Bottom Sheet Swipe-to-Close Logic ---
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let rafId = null;

  const updatePosition = () => {
    if (!isDragging) return;
    sheet.style.transform = `translate3d(0, ${currentY}px, 0)`;
    rafId = requestAnimationFrame(updatePosition);
  };

  const handlePointerDown = (e) => {
    if (e.target.closest('#sheet-handle') || e.target.closest('h2') || e.target === sheet) {
      isDragging = true;
      startY = e.clientY - currentY; // Consistent start from current position
      sheet.setPointerCapture(e.pointerId);
      sheet.classList.add("shifting");
      
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updatePosition);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startY;
    currentY = Math.max(0, deltaY);
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    sheet.releasePointerCapture(e.pointerId);
    sheet.classList.remove("shifting");
    cancelAnimationFrame(rafId);

    const threshold = sheet.offsetHeight * 0.05; // Honoring user's 5% change
    
    if (currentY > threshold) {
      // Use Web Animations API to finish the motion fluidly to the bottom (100%)
      const closingAnim = sheet.animate([
        { transform: `translate3d(0, ${currentY}px, 0)` },
        { transform: `translate3d(0, 100%, 0)` }
      ], {
        duration: 250,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'forwards'
      });

      closingAnim.onfinish = () => {
        sheet.classList.remove("shifting");
        sheet.style.transform = "";
        hideBottomSheet();
        closingAnim.cancel(); // Remove the "fill: forwards" effect so CSS takes over
        currentY = 0;
      };
    } else {
      // Snap back to 0
      const snapAnim = sheet.animate([
        { transform: `translate3d(0, ${currentY}px, 0)` },
        { transform: `translate3d(0, 0, 0)` }
      ], {
        duration: 200,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'forwards'
      });

      snapAnim.onfinish = () => {
        sheet.classList.remove("shifting");
        sheet.style.transform = "";
        snapAnim.cancel();
        currentY = 0;
      };
    }
  };

  sheet.addEventListener("pointerdown", handlePointerDown);
  sheet.addEventListener("pointermove", handlePointerMove);
  sheet.addEventListener("pointerup", handlePointerUp);
  sheet.addEventListener("pointercancel", handlePointerUp);

  // --- FAB Button Listeners ---
  const infoBtn = document.getElementById("open-info-btn");

  if (infoBtn) {
    infoBtn.addEventListener("click", () => {
      showInfo();
    });
  }
}



export function showInfo() {
  console.log("Info button clicked - function placeholder");
  // Future implementation: show app info / tutorial modal
}
