/**
 * ==========================================================================
 * PORSCHE SALES INTELLIGENCE - APP LOGIC (VANILLA JS)
 * Handles data filtering, pagination, KPI metrics, charts, and insights.
 * ==========================================================================
 */

// Application State
let state = {
    allData: [],
    filteredData: [],
    currentPage: 1,
    pageSize: 10,
    filters: {
        model: '',
        year: '',
        city: '',
        payment: ''
    },
    searchQuery: ''
};

// Chart References
let chartModelsInstance = null;
let chartPaymentsInstance = null;

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if data is loaded
    if (typeof PORSCHE_DATA !== 'undefined') {
        state.allData = PORSCHE_DATA;
    } else {
        console.error("Dados de vendas não encontrados. Verifique se o arquivo 'data.js' está presente.");
        return;
    }

    initializeFilters();
    applyFiltersAndRefresh();
    setupEventListeners();
});

// Extract unique values and populate filter selects
function initializeFilters() {
    const models = new Set();
    const years = new Set();
    const cities = new Set();
    const payments = new Set();

    state.allData.forEach(item => {
        if (item.PorscheModelSanitized) models.add(item.PorscheModelSanitized);
        if (item.ModelYearSanitized !== null && item.ModelYearSanitized !== undefined) {
            years.add(item.ModelYearSanitized);
        }
        if (item.CitySanitized) cities.add(item.CitySanitized);
        if (item.PayMethodSanitized) payments.add(item.PayMethodSanitized);
    });

    populateSelect('filter-model', sortedArrayFromSet(models));
    populateSelect('filter-year', sortedArrayFromSet(years, true)); // sort numeric
    populateSelect('filter-city', sortedArrayFromSet(cities));
    populateSelect('filter-payment', sortedArrayFromSet(payments));
}

function sortedArrayFromSet(set, isNumeric = false) {
    const arr = Array.from(set);
    if (isNumeric) {
        return arr.sort((a, b) => a - b);
    }
    return arr.sort((a, b) => String(a).localeCompare(String(b)));
}

function populateSelect(elementId, items) {
    const select = document.getElementById(elementId);
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Select Filters
    document.getElementById('filter-model').addEventListener('change', (e) => {
        state.filters.model = e.target.value;
        state.currentPage = 1;
        applyFiltersAndRefresh();
    });
    
    document.getElementById('filter-year').addEventListener('change', (e) => {
        state.filters.year = e.target.value;
        state.currentPage = 1;
        applyFiltersAndRefresh();
    });

    document.getElementById('filter-city').addEventListener('change', (e) => {
        state.filters.city = e.target.value;
        state.currentPage = 1;
        applyFiltersAndRefresh();
    });

    document.getElementById('filter-payment').addEventListener('change', (e) => {
        state.filters.payment = e.target.value;
        state.currentPage = 1;
        applyFiltersAndRefresh();
    });

    // Search Input
    document.getElementById('table-search').addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        state.currentPage = 1;
        applyFiltersAndRefresh();
    });

    // Clear Filters Button
    document.getElementById('btn-clear-filters').addEventListener('click', () => {
        document.getElementById('filter-model').value = '';
        document.getElementById('filter-year').value = '';
        document.getElementById('filter-city').value = '';
        document.getElementById('filter-payment').value = '';
        document.getElementById('table-search').value = '';

        state.filters = { model: '', year: '', city: '', payment: '' };
        state.searchQuery = '';
        state.currentPage = 1;
        applyFiltersAndRefresh();
    });

    // Pagination
    document.getElementById('btn-prev').addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderTable();
        }
    });

    document.getElementById('btn-next').addEventListener('click', () => {
        const totalPages = Math.ceil(state.filteredData.length / state.pageSize);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            renderTable();
        }
    });
}

// Filter core logic
function applyFiltersAndRefresh() {
    state.filteredData = state.allData.filter(item => {
        // Model Filter
        if (state.filters.model && item.PorscheModelSanitized !== state.filters.model) return false;
        
        // Year Filter
        if (state.filters.year && String(item.ModelYearSanitized) !== String(state.filters.year)) return false;
        
        // City Filter
        if (state.filters.city && item.CitySanitized !== state.filters.city) return false;
        
        // Payment Filter
        if (state.filters.payment && item.PayMethodSanitized !== state.filters.payment) return false;

        // Search text filter
        if (state.searchQuery) {
            const customer = (item.customer_name || '').toLowerCase();
            const model = (item.PorscheModelSanitized || '').toLowerCase();
            const city = (item.CitySanitized || '').toLowerCase();
            const salesperson = (item.salesperson || '').toLowerCase();
            const payment = (item.PayMethodSanitized || '').toLowerCase();
            const price = String(item.SalesPriceSanitized || '').toLowerCase();
            
            const match = customer.includes(state.searchQuery) ||
                          model.includes(state.searchQuery) ||
                          city.includes(state.searchQuery) ||
                          salesperson.includes(state.searchQuery) ||
                          payment.includes(state.searchQuery) ||
                          price.includes(state.searchQuery);
            if (!match) return false;
        }

        return true;
    });

    // Update UI Elements
    updateFilterCounts();
    calculateKPIs();
    renderCharts();
    renderInsights();
    renderTable();
}

function updateFilterCounts() {
    const countSpan = document.getElementById('active-filters-count');
    countSpan.textContent = `Exibindo ${state.filteredData.length} de ${state.allData.length} registros`;
}

// Calculate KPIs based on filtered data
function calculateKPIs() {
    const totalSales = state.filteredData.length;
    let totalRevenue = 0;
    const modelCounts = {};

    state.filteredData.forEach(item => {
        if (item.SalesPriceSanitized) {
            totalRevenue += parseFloat(item.SalesPriceSanitized);
        }
        if (item.PorscheModelSanitized) {
            modelCounts[item.PorscheModelSanitized] = (modelCounts[item.PorscheModelSanitized] || 0) + 1;
        }
    });

    const avgPrice = totalSales > 0 ? (totalRevenue / totalSales) : 0;
    
    // Find most sold model
    let topModel = '-';
    let maxSales = 0;
    Object.entries(modelCounts).forEach(([model, count]) => {
        if (count > maxSales) {
            maxSales = count;
            topModel = model;
        }
    });

    // Animate and update values in UI
    animateValue('val-revenue', totalRevenue, true);
    animateValue('val-sales', totalSales, false);
    animateValue('val-avg-price', avgPrice, true);
    
    document.getElementById('val-top-model').textContent = topModel + (maxSales > 0 ? ` (${maxSales}x)` : '');
}

// Animate numbers for rich feedback
function animateValue(id, value, isCurrency = false) {
    const element = document.getElementById(id);
    const duration = 500;
    const steps = 20;
    const stepValue = value / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
        currentStep++;
        const currentVal = stepValue * currentStep;
        
        if (currentStep >= steps) {
            clearInterval(interval);
            element.textContent = isCurrency ? formatCurrency(value) : Math.round(value);
        } else {
            element.textContent = isCurrency ? formatCurrency(currentVal) : Math.round(currentVal);
        }
    }, duration / steps);
}

function formatCurrency(val) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(val).replace('$', '$ ');
}

// Render Table Page
function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    const totalPages = Math.ceil(state.filteredData.length / state.pageSize) || 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    const startIdx = (state.currentPage - 1) * state.pageSize;
    const endIdx = Math.min(startIdx + state.pageSize, state.filteredData.length);

    document.getElementById('pagination-info').textContent = `Página ${state.currentPage} de ${totalPages}`;

    if (state.filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">Nenhum registro encontrado com os filtros selecionados.</td></tr>`;
        return;
    }

    const pageItems = state.filteredData.slice(startIdx, endIdx);
    
    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        
        // Status class resolver
        const status = (item.DeliveryStatusSanitized || 'Pendente').trim();
        let statusClass = 'status-pending';
        if (status === 'Delivered') statusClass = 'status-delivered';
        if (status === 'Shipped') statusClass = 'status-shipped';
        if (status === 'Cancelled') statusClass = 'status-cancelled';

        // Translate status for display
        let displayStatus = 'Pendente';
        if (status === 'Delivered') displayStatus = 'Entregue';
        if (status === 'Shipped') displayStatus = 'Enviado';
        if (status === 'Cancelled') displayStatus = 'Cancelado';
        if (status === 'Pending Approval') displayStatus = 'Pendente de Aprov.';
        if (status === 'Awaiting Delivery') displayStatus = 'Aguard. Entrega';
        if (status === 'In Transit') displayStatus = 'Em trânsito';

        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--porsche-gold);">${item.sale_id || '-'}</td>
            <td>${item.customer_name || '-'}</td>
            <td style="font-weight: 500;">${item.PorscheModelSanitized || '-'}</td>
            <td>${item.ModelYearSanitized || '-'}</td>
            <td style="font-weight: 600;">${item.SalesPriceSanitized ? formatCurrency(item.SalesPriceSanitized) : '-'}</td>
            <td>${item.VehicleMileageSanitized !== null ? Number(item.VehicleMileageSanitized).toLocaleString() + ' mi' : '0 mi'}</td>
            <td>${item.PayMethodSanitized || '-'}</td>
            <td>${item.CitySanitized || '-'}</td>
            <td>${item.StateSanitized || '-'}</td>
            <td style="color: var(--color-text-secondary);">${item.salesperson || '-'}</td>
            <td><span class="status-badge ${statusClass}">${displayStatus}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Render Charts
function renderCharts() {
    renderModelsChart();
    renderPaymentsChart();
}

function renderModelsChart() {
    const modelCounts = {};
    state.filteredData.forEach(item => {
        if (item.PorscheModelSanitized) {
            modelCounts[item.PorscheModelSanitized] = (modelCounts[item.PorscheModelSanitized] || 0) + 1;
        }
    });

    const sortedModels = Object.entries(modelCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // top 10 models

    const labels = sortedModels.map(m => m[0]);
    const data = sortedModels.map(m => m[1]);

    const ctx = document.getElementById('chart-models').getContext('2d');
    
    if (chartModelsInstance) {
        chartModelsInstance.destroy();
    }

    chartModelsInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Unidades Vendidas',
                data: data,
                backgroundColor: 'rgba(200, 150, 62, 0.75)',
                borderColor: '#c8963e',
                borderWidth: 1.5,
                hoverBackgroundColor: '#dfb260'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#18181e',
                    titleFont: { family: 'Cinzel', size: 13 },
                    bodyFont: { family: 'Inter', size: 12 },
                    borderColor: '#2c2e35',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#8a939f', font: { family: 'Inter', size: 10 } }
                },
                y: {
                    grid: { color: '#2c2e35' },
                    ticks: { color: '#8a939f', precision: 0 }
                }
            }
        }
    });
}

function renderPaymentsChart() {
    const payCounts = {};
    state.filteredData.forEach(item => {
        if (item.PayMethodSanitized) {
            payCounts[item.PayMethodSanitized] = (payCounts[item.PayMethodSanitized] || 0) + 1;
        }
    });

    const labels = Object.keys(payCounts);
    const data = Object.values(payCounts);

    const ctx = document.getElementById('chart-payments').getContext('2d');

    if (chartPaymentsInstance) {
        chartPaymentsInstance.destroy();
    }

    const colorPalette = [
        'rgba(213, 0, 28, 0.8)',   // Speed Red
        'rgba(200, 150, 62, 0.8)',  // Porsche Gold
        'rgba(138, 147, 159, 0.8)', // Silver Metallic
        'rgba(46, 117, 89, 0.8)',   // Mamba Green
        'rgba(59, 130, 246, 0.8)',  // Miami Blue
        'rgba(251, 146, 60, 0.8)',  // Papaya Metallic
        'rgba(107, 114, 128, 0.8)', // Grey
        'rgba(147, 51, 234, 0.8)'   // Purple
    ];

    chartPaymentsInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colorPalette,
                borderColor: '#18181e',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#9da3ae',
                        font: { family: 'Inter', size: 10 },
                        boxWidth: 10,
                        padding: 10
                    }
                },
                tooltip: {
                    backgroundColor: '#18181e',
                    borderColor: '#2c2e35',
                    borderWidth: 1
                }
            },
            cutout: '65%'
        }
    });
}

// Render Dynamic Insights (Perguntas da Planilha)
function renderInsights() {
    renderMainModelsByCityInsight();
    renderYearsTimelineInsight();
    renderPopularCityInsight();
}

// Insight 1: quais os principais modelos de carro vendidos por cidades?
function renderMainModelsByCityInsight() {
    const container = document.getElementById('insight-models-city');
    container.innerHTML = '';

    // Group models by city
    const cityModels = {};
    state.filteredData.forEach(item => {
        const city = item.CitySanitized;
        const model = item.PorscheModelSanitized;
        if (city && model) {
            if (!cityModels[city]) cityModels[city] = [];
            cityModels[city].push(model);
        }
    });

    // Find top 3 cities by volume
    const sortedCities = Object.entries(cityModels)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 3); // Get top 3 cities for readability

    if (sortedCities.length === 0) {
        container.innerHTML = `<p style="color: var(--color-text-muted); font-size: 0.85rem;">Nenhum dado de cidade disponível com a filtragem atual.</p>`;
        return;
    }

    sortedCities.forEach(([city, models]) => {
        // Count model occurrences in this city
        const modelCounts = {};
        models.forEach(m => modelCounts[m] = (modelCounts[m] || 0) + 1);
        
        const topModels = Object.entries(modelCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2); // Top 2 models in city

        const modelStr = topModels.map(m => `${m[0]} (${m[1]}x)`).join(', ');

        const div = document.createElement('div');
        div.className = 'insight-item';
        div.innerHTML = `
            <div class="insight-item-title">
                <span><i class="fa-solid fa-location-dot"></i> ${city}</span>
                <span class="insight-item-meta">${models.length} venda(s)</span>
            </div>
            <div class="insight-item-desc">Modelos líderes: ${modelStr}</div>
        `;
        container.appendChild(div);
    });
}

// Insight 2: qual ano de modelo de carro saiu no período?
function renderYearsTimelineInsight() {
    const container = document.getElementById('insight-years-timeline');
    container.innerHTML = '';

    const years = new Set();
    state.filteredData.forEach(item => {
        if (item.ModelYearSanitized !== null && item.ModelYearSanitized !== undefined) {
            years.add(item.ModelYearSanitized);
        }
    });

    const sortedYears = Array.from(years).sort((a, b) => a - b);

    if (sortedYears.length === 0) {
        container.innerHTML = `<p style="color: var(--color-text-muted); font-size: 0.85rem;">Nenhum ano disponível com a filtragem atual.</p>`;
        return;
    }

    sortedYears.forEach(year => {
        const badge = document.createElement('span');
        badge.className = 'timeline-badge';
        badge.innerHTML = `<i class="fa-solid fa-clock"></i> ${year}`;
        container.appendChild(badge);
    });
}

// Insight 3: insight de carros populares em vendas com base nos dados em cada cidade
function renderPopularCityInsight() {
    const container = document.getElementById('insight-popular-city');
    container.innerHTML = '';

    // Group data by city
    const cityData = {};
    state.filteredData.forEach(item => {
        const city = item.CitySanitized;
        if (city) {
            if (!cityData[city]) cityData[city] = [];
            cityData[city].push(item);
        }
    });

    // Sort cities by number of sales
    const sortedCities = Object.entries(cityData)
        .sort((a, b) => b[1].length - a[1].length);

    if (sortedCities.length === 0) {
        container.innerHTML = `<p style="color: var(--color-text-muted); font-size: 0.85rem;">Sem insights disponíveis para os filtros atuais.</p>`;
        return;
    }

    // List top cities popularity insight (max 5 for rendering elegance)
    sortedCities.slice(0, 5).forEach(([city, records]) => {
        const modelCounts = {};
        records.forEach(r => {
            if (r.PorscheModelSanitized) {
                modelCounts[r.PorscheModelSanitized] = (modelCounts[r.PorscheModelSanitized] || 0) + 1;
            }
        });

        // Find bestseller in city
        let bestSeller = '';
        let bestCount = 0;
        Object.entries(modelCounts).forEach(([m, c]) => {
            if (c > bestCount) {
                bestCount = c;
                bestSeller = m;
            }
        });

        // Calculate avg price for this bestseller in this city
        const relevantPrices = records
            .filter(r => r.PorscheModelSanitized === bestSeller && r.SalesPriceSanitized)
            .map(r => parseFloat(r.SalesPriceSanitized));
        
        const avgPrice = relevantPrices.length > 0 
            ? relevantPrices.reduce((a, b) => a + b, 0) / relevantPrices.length 
            : 0;

        const pct = ((bestCount / records.length) * 100).toFixed(0);

        const div = document.createElement('div');
        div.className = 'insight-item';
        div.style.marginBottom = '0.5rem';
        div.innerHTML = `
            <div class="insight-item-title">
                <span><i class="fa-solid fa-star"></i> ${city}</span>
                <span style="color: var(--porsche-red);">${pct}% das vendas locais</span>
            </div>
            <div class="insight-item-desc">${bestSeller} (${bestCount} unid.)</div>
            <div class="insight-item-meta">Preço médio nesta cidade: ${formatCurrency(avgPrice)}</div>
        `;
        container.appendChild(div);
    });
}
