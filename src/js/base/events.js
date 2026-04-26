const ccaToggleBtn = document.getElementById('events-cca-toggle-btn');
const dunklistToggleBtn = document.getElementById('events-dunklist-toggle-btn');
const pabuskingToggleBtn = document.getElementById('events-pabusking-toggle-btn');
const eventsListContainer = document.getElementById('events-list-container');

const eventCategories = {
    cca: ccaToggleBtn,
    dunklist: dunklistToggleBtn,
    pabusking: pabuskingToggleBtn
};

function parseTimeToMinutes(timeStr) {
if (!timeStr) return 0;
const [time, period] = timeStr.split(' ');
if (!time || !period) return 0;
let [hours, minutes] = time.split(':').map(Number);
if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
return hours * 60 + minutes;
}

async function switchEventCategory(category) {
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
        const data = await response.json();

        if (!data.events || data.events.length === 0) {
            eventsListContainer.innerHTML = '<p class="text-center opacity-50 py-10">No events scheduled in this category.</p>';
            return;
        }

        let html = `
        <header class="mb-8 w-full text-left">
            <h1 class="font-headline text-2xl font-bold tracking-tight text-ctp-text leading-none mb-1">Schedule</h1>
            <p class="text-ctp-subtext0 font-body text-sm">${data.subtitle || ''}</p>
        </header>
        <div class="w-full text-left relative pl-6 md:pl-8 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-ctp-surface2">
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
            titleColor = 'text-ctp-text'; // "white"
            boxClass = 'bg-ctp-surface0 ring-1 ring-ctp-surface1 hover:bg-ctp-surface1';
        }
        
        let tagsHtml = '';
        if (ev.location) {
            tagsHtml += `
                <span class="bg-ctp-blue/20 text-ctp-blue px-3 py-1 rounded-full font-label text-[10px] uppercase tracking-widest flex items-center gap-1 w-fit">
                <span class="material-symbols-outlined text-[12px]">location_on</span>
                ${ev.location}
                </span>
            `;
        }
        if (ev.tags) {
            ev.tags.forEach(tag => {
                tagsHtml += `
                <span class="border border-ctp-surface2 ${status === 'past' ? 'text-ctp-subtext0' : 'text-ctp-subtext1'} px-3 py-1 rounded-full font-label text-[10px] uppercase tracking-widest flex items-center gap-1 w-fit">
                ${tag.icon ? `<span class="material-symbols-outlined text-[12px]">${tag.icon}</span>` : ''}
                ${tag.text}
                </span>
                `;
            });
        }

        html += `
            <div class="relative mb-8 group w-full">
            <div class="absolute left-[-29px] md:left-[-37px] top-1 w-3 h-3 ${nodeColor} rounded-full ring-4 ring-ctp-base z-10 transition-all duration-300"></div>
            
            <div class="flex flex-col gap-1 mb-3">
                <span class="font-label ${timeColor} text-[10px] uppercase tracking-widest transition-colors">${ev.time}</span>
                <h3 class="font-headline text-lg ${titleColor} transition-colors">${ev.title}</h3>
            </div>
        `;

        if (!ev.isSessionHeader) {
            html += `
            <div class="${boxClass} p-5 rounded-xl relative overflow-hidden transition-all duration-300">
                ${ev.description ? `<p class="font-body text-sm ${status === 'past' ? 'text-ctp-subtext0' : 'text-ctp-subtext1'} mb-4 leading-relaxed">${ev.description}</p>` : ''}
                
                <div class="flex items-center gap-2 flex-wrap">
                ${tagsHtml}
                </div>
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
            <div class="absolute left-[-29px] md:left-[-37px] top-1 w-3 h-3 ${endNodeColor} rounded-full ring-4 ring-ctp-base z-10 transition-colors duration-300"></div>
            <span class="font-label ${endTextColor} text-[10px] uppercase tracking-widest block pt-0.5 transition-colors">${data.endText || 'End of Schedule'}</span>
            </div>
        </div>
        `;

        eventsListContainer.innerHTML = html;

    } catch (err) {
        console.error("Error rendering timeline:", err);
        eventsListContainer.innerHTML = '<p class="text-center text-ctp-red py-10">Failed to load events. Please try again later.</p>';
    }
}

ccaToggleBtn.addEventListener('click', () => switchEventCategory('cca'));
dunklistToggleBtn.addEventListener('click', () => switchEventCategory('dunklist'));
pabuskingToggleBtn.addEventListener('click', () => switchEventCategory('pabusking'));

switchEventCategory('cca');
