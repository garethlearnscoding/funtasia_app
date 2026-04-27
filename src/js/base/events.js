import { focusOnBooth } from "@/js/feature/directory.js";

const ccaToggleBtn = document.getElementById('events-cca-toggle-btn');
const dunklistToggleBtn = document.getElementById('events-dunklist-toggle-btn');
const pabuskingToggleBtn = document.getElementById('events-pabusking-toggle-btn');
const eventsListContainer = document.getElementById('events-list-container');

const eventCategories = {
    cca: ccaToggleBtn,
    dunklist: dunklistToggleBtn,
    pabusking: pabuskingToggleBtn
};

function parseTimeToMinutes(timeInput) {
    if (!timeInput) return 0;
    const timeStr = String(timeInput);

    // Strictly handle 24h 4-digit string format (e.g. "1330" or "0930")
    if (/^\d{4}$/.test(timeStr)) {
        const hours = Number(timeStr.slice(0, 2));
        const minutes = Number(timeStr.slice(2, 4));
        return hours * 60 + minutes;
    }

    return 0;
}

function formatTime(timeInput) {
    if (!timeInput) return "";
    const timeStr = String(timeInput);
    // Format 4-digit 24h string (e.g., "1330") to 12h string (e.g., "1:30 PM")
    if (/^\d{4}$/.test(timeStr)) {
        let hours = Number(timeStr.slice(0, 2));
        const minutes = timeStr.slice(2, 4);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        return `${hours}:${minutes} ${ampm}`;
    }
    return timeStr;
}

export async function switchEventCategory(category) {
    // Update Buttons
    Object.entries(eventCategories).forEach(([key, btn]) => {
        if (key === category) {
        btn.style.background = 'var(--color-ctp-mauve)';
        btn.style.color = 'var(--color-ctp-base)';
        } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--color-ctp-text)';
        }
    });

    // Update Content
    eventsListContainer.innerHTML = '<p class="text-center opacity-50 py-10">Loading events...</p>';

    try {
        const response = await fetch(`/funtasia_app/src/assets/events/${category}_events.json`);
        if (!response.ok) throw new Error('Failed to load events for ' + category);
        const data_arr = await response.json();

        let html = '';
        let currentEventID = null;
        data_arr.forEach((data, index) => {
            if (!data.events || data.events.length === 0) {
                eventsListContainer.innerHTML = '<p class="text-center opacity-50 py-10">No events scheduled in this category.</p>';
                return;
            }
            let eventID = "events-item-" + (index + 1)
            html += `
            <header id="${eventID}" class="mb-8 w-full text-left sticky top-0 left-[-12] bg-ctp-base text-ctp-base z-30">
                <div class="flex flex-row mb-1 justify-items-center w-full">
                    <h1 class="font-headline text-3xl font-bold tracking-tight text-ctp-text leading-none mr-2 sticky top-0">${data.title}</h1>
                    <span class="events-location cursor-pointer hover:opacity-70 transition-opacity active:scale-95" data-booth-id="${data.location}">
                        <span class="material-symbols-outlined text-[12px]">location_on</span>${data.location}
                    </span>
                </div>
                <p class="text-ctp-subtext0 font-body text-sm w-full">${data.subtitle || '<br>'}</p>
                <div class="absolute left-[-6px] top-[-32px] w-[calc(100%+12px)] bg-ctp-base -z-10 h-28"></div> 
            </header>
            <div class="events-timeline">
            `;

            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            let isAllPast = true;

            data.events.forEach((ev, index) => {
                const evMins = parseTimeToMinutes(ev.time);
                let nextEvMins = Infinity;
                
                if (ev.endTime) {
                    nextEvMins = parseTimeToMinutes(ev.endTime);
                } else {
                    for (let i = index + 1; i < data.events.length; i++) {
                        if (data.events[i].time) {
                            nextEvMins = parseTimeToMinutes(data.events[i].time);
                            break;
                        }
                    }
                }

                let status = 'future';
                if (currentMinutes >= nextEvMins) {
                    status = 'past';
                } else if (currentMinutes >= evMins && currentMinutes < nextEvMins) {
                    status = 'current';
                    isAllPast = false;
                } else {
                    status = 'future';
                    isAllPast = false;
                }

                if (!isAllPast && !currentEventID) currentEventID = eventID

                let nodeColor, timeColor, titleColor, boxClass;

                if (status === 'past') {
                    nodeColor = 'bg-ctp-surface2';
                    timeColor = 'text-ctp-subtext0';
                    titleColor = 'text-ctp-subtext0';
                    boxClass = 'bg-ctp-surface0/50 opacity-50 ring-1 ring-ctp-surface1';
                } else if (status === 'current') {
                    nodeColor = 'bg-ctp-mauve shadow-[0_0_10px_var(--color-ctp-mauve)]';
                    timeColor = 'text-ctp-mauve font-bold';
                    titleColor = 'text-ctp-text font-bold';
                    boxClass = 'bg-ctp-surface0 ring-1 ring-ctp-mauve/70 shadow-lg shadow-ctp-mauve/10';
                } else { // future
                    nodeColor = 'bg-ctp-surface2 group-hover:bg-ctp-mauve';
                    timeColor = 'text-ctp-subtext0';
                    titleColor = 'text-ctp-text';
                    boxClass = 'bg-ctp-surface0 ring-1 ring-ctp-surface1 hover:bg-ctp-surface1';
                }

                html += `
                    <div class="events-item-container group">
                        <div class="${nodeColor} events-item-dots"></div>
                    
                        <div class="flex flex-col gap-1 mb-3">
                            <span class="${timeColor} events-item-time">${formatTime(ev.time)}</span>
                            <h3 class="${titleColor} events-item-title">${ev.title}</h3>
                        </div>
                `;

                if (!ev.isSessionHeader && ev.description) {
                    html += `
                    <div class="${boxClass} events-item-body">
                        <p class="${status === 'past' ? 'text-ctp-subtext0' : 'text-ctp-subtext1'} events-item-description">${ev.description}</p>
                    </div>
                    `;
                }

                html += `</div>`; // Close timeline item
            });

            // End Node
            const endNodeColor = isAllPast ? 'bg-ctp-mauve shadow-[0_0_10px_var(--color-ctp-mauve)]' : 'bg-ctp-surface2';
            const endTextColor = isAllPast ? 'text-ctp-text font-bold' : 'text-ctp-subtext0';
            
            html += `
                <div class="relative w-full">
                <div class="${endNodeColor} events-item-dots"></div>
                <span class="font-label ${endTextColor} events-item-time block pt-0.5 ">${data.endText || 'End of Schedule'}</span>
                </div>
            </div>
            `;
        });
        eventsListContainer.innerHTML = html;
        if (currentEventID) {
            const eventHeader = document.getElementById(currentEventID);
            eventHeader.scrollIntoView({
                behavior: "smooth",
                block: "start",
                container: "nearest",
            });
        }
    } catch (err) {
        console.error("Error rendering timeline:", err);
        eventsListContainer.innerHTML = '<p class="text-center text-ctp-red py-10">Failed to load events. Please try again later.</p>';
    }

    // Delegate click events for locations
    eventsListContainer.addEventListener('click', (e) => {
        const locationTag = e.target.closest('.events-location');
        if (locationTag && locationTag.dataset.boothId) {
            const boothId = locationTag.dataset.boothId.trim();
            if (boothId && boothId !== "-") focusOnBooth(boothId);
        }
    });
}