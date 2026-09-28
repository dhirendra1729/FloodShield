document.addEventListener("DOMContentLoaded", () => {
    // Initialize map centered on Bhuragaon, Assam
    const map = L.map('map').setView([26.26, 92.22], 13);

    // Add OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Simulation Button Interaction
    document.getElementById('simulate-btn').addEventListener('click', async () => {
        const btn = document.getElementById('simulate-btn');
        const aiOutput = document.getElementById('ai-output');
        
        btn.innerText = "Simulating...";
        btn.disabled = true;

        // Mock delay to represent API call processing
        setTimeout(() => {
            aiOutput.innerHTML = `
                <div class="text-green-600 font-bold">Status: Complete</div>
                <p class="mt-2"><b>Recommended Shelter:</b> Govt High School</p>
                <p><b>Distance:</b> 850m</p>
                <p class="mt-2 text-gray-700 italic">"Based on current flood predictions, evacuate to Govt High School via Market Road. Avoid River Embankment Road."</p>
            `;
            btn.innerText = "Run Simulation";
            btn.disabled = false;
        }, 2000);
    });
});
