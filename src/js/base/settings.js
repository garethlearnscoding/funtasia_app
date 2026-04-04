export class SettingsController {
    static init(containerId) {
        this.container = document.getElementById(containerId);
        if (this.container) {
            this.container.innerHTML = ''; // Clear placeholders
            this.container.className = 'px-2 pb-6 space-y-6'; // Add some standard spacing
        }
    }

    static addSection(title) {
        if (!this.container) return;
        
        const sectionDiv = document.createElement('section');
        // Add spacing between sections but not above the first
        sectionDiv.className = 'mt-6 first:mt-0';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'mb-4';
        headerDiv.innerHTML = `<h2 class="modal-section-title">${title}</h2>`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'bg-surface rounded-xl border border-outline-variant/30 overflow-hidden';
        
        sectionDiv.appendChild(headerDiv);
        sectionDiv.appendChild(contentDiv);
        this.container.appendChild(sectionDiv);
        
        return contentDiv; // Return content wrapper for items to easily attach themselves here
    }

    static addToggle(parentContainer, label, description, onToggle, initialValue = true) {
        const targetContainer = parentContainer || this.container;
        if (!targetContainer) return;
        
        const wrapper = document.createElement('div');
        // Adding Funtasia's clean modular styling to the row
        wrapper.className = "flex items-center justify-between p-4 border-b border-outline-variant/20 last:border-0 cursor-pointer active:bg-surface-variant/50 transition-colors";
        
        // Setup toggle label content
        const contentDiv = document.createElement('div');
        contentDiv.className = "flex-1 pr-4";
        contentDiv.innerHTML = `
            <h3 class="text-on-surface font-semibold text-[15px] leading-tight">${label}</h3>
            ${description ? `<p class="text-on-surface-variant text-sm mt-1 leading-snug">${description}</p>` : ''}
        `;
        
        // Setup toggle switch
        const switchLabel = document.createElement('label');
        switchLabel.className = "relative inline-flex items-center cursor-pointer pointer-events-none"; // wrapper handles click 
        
        const input = document.createElement('input');
        input.type = "checkbox";
        input.className = "sr-only peer";
        input.checked = initialValue;
        
        const slider = document.createElement('div');
        // Smooth toggle animation styling utilizing Funtasia's 'primary' color
        slider.className = "w-11 h-6 bg-outline/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:bg-primary transition-colors duration-300";
        
        switchLabel.appendChild(input);
        switchLabel.appendChild(slider);
        
        wrapper.appendChild(contentDiv);
        wrapper.appendChild(switchLabel);
        
        // Entire row is clickable for better UX
        wrapper.addEventListener('click', () => {
            input.checked = !input.checked;
            if (onToggle) onToggle(input.checked);
        });

        targetContainer.appendChild(wrapper);
        return wrapper;
    }
}
