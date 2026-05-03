const indices = {
    kospi: { symbol: '^KS11', id: 'kospiChart', valueId: 'kospi-value', changeId: 'kospi-change', data: [], color: '#00ffa3', fallback: 2750, displayName: '코스피' },
    kosdaq: { symbol: '^KQ11', id: 'kosdaqChart', valueId: 'kosdaq-value', changeId: 'kosdaq-change', data: [], color: '#ff4d4d', fallback: 850, displayName: '코스닥' },
    nasdaq: { symbol: '^IXIC', id: 'nasdaqChart', valueId: 'nasdaq-value', changeId: 'nasdaq-change', data: [], color: '#00ffa3', fallback: 16500, displayName: '나스닥' },
    sp500: { symbol: '^GSPC', id: 'sp500Chart', valueId: 'sp500-value', changeId: 'sp500-change', data: [], color: '#00ffa3', fallback: 5200, displayName: 'S&P 500' }
};

const charts = {};
// Using multiple proxies for robustness
const PROXY_URLS = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/get?url='
];

// Helper to fetch data with proxy fallback
async function fetchWithProxy(targetUrl) {
    // Try primary proxy (corsproxy.io)
    try {
        const response = await fetch(PROXY_URLS[0] + encodeURIComponent(targetUrl));
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.warn("Primary proxy failed, trying secondary...");
    }

    // Try secondary proxy (allorigins)
    try {
        const response = await fetch(PROXY_URLS[1] + encodeURIComponent(targetUrl));
        const json = await response.json();
        if (json && json.contents) {
            return JSON.parse(json.contents);
        }
    } catch (e) {
        console.error("All proxies failed.");
    }
    return null;
}

// Initialize Charts
async function initCharts() {
    for (const key in indices) {
        const ctx = document.getElementById(indices[key].id).getContext('2d');
        await fetchIndexData(key);

        charts[key] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(indices[key].data.length).fill(''),
                datasets: [{
                    data: indices[key].data,
                    borderColor: indices[key].color,
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    backgroundColor: createGradient(ctx, indices[key].color),
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { display: false } },
                animation: { duration: 1000 }
            }
        });
    }
}

async function fetchIndexData(key) {
    const index = indices[key];
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${index.symbol}?interval=1mo&range=5y`;
    
    const data = await fetchWithProxy(yahooUrl);
    
    if (data && data.chart && data.chart.result) {
        const result = data.chart.result[0];
        const quote = result.indicators.quote[0].close;
        const meta = result.meta;
        
        index.data = quote.filter(val => val !== null);
        index.currentPrice = meta.regularMarketPrice;
        index.prevClose = meta.previousClose;
        updateUI(key);
    } else {
        // Fallback to realistic dummy data if fetch fails
        if (index.data.length === 0) {
            const base = index.fallback;
            index.data = Array(20).fill(0).map((_, i) => base + Math.random() * (base * 0.01));
            index.currentPrice = index.data[index.data.length - 1];
            index.prevClose = base;
            updateUI(key);
        }
    }
}

function updateUI(key) {
    const index = indices[key];
    const diff = index.currentPrice - index.prevClose;
    const percent = (diff / index.prevClose) * 100;
    
    const valueEl = document.getElementById(index.valueId);
    const changeEl = document.getElementById(index.changeId);
    
    if (valueEl && changeEl) {
        valueEl.innerText = index.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        changeEl.innerText = `${diff > 0 ? '+' : ''}${diff.toFixed(2)} (${percent.toFixed(2)}%)`;
        changeEl.className = `index-change ${diff > 0 ? 'up' : 'down'}`;
        
        if (charts[key]) {
            const color = diff > 0 ? '#00ffa3' : '#ff4d4d';
            charts[key].data.datasets[0].borderColor = color;
            charts[key].data.datasets[0].backgroundColor = createGradient(document.getElementById(index.id).getContext('2d'), color);
            charts[key].update();
        }
    }
}

function createGradient(ctx, color) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 120);
    let rgbaColor;
    if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        rgbaColor = `rgba(${r}, ${g}, ${b}, 0.2)`;
    } else {
        rgbaColor = color.replace('rgb', 'rgba').replace(')', ', 0.2)');
    }
    gradient.addColorStop(0, rgbaColor);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    return gradient;
}

async function refreshAllData() {
    for (const key in indices) {
        await fetchIndexData(key);
        if (charts[key]) {
            charts[key].data.datasets[0].data = indices[key].data;
            charts[key].update('none');
        }
    }
}

let resultChart = null;

let currentTicker = '';
let currentRange = '5y';
let currentInterval = '1mo';

async function searchTicker(range = '5y', interval = '1mo') {
    const input = document.getElementById('ticker-input');
    const exchangeSelect = document.getElementById('exchange-select');
    let ticker = currentTicker || input.value.trim().toUpperCase();
    const exchange = exchangeSelect.value;

    if (!ticker) return;
    currentTicker = ticker;
    currentRange = range;
    currentInterval = interval;

    // Apply suffixes based on exchange if not already present
    if (exchange === 'KS' && !ticker.endsWith('.KS')) {
        ticker += '.KS';
    } else if (exchange === 'KQ' && !ticker.endsWith('.KQ')) {
        ticker += '.KQ';
    } else if (exchange === 'SPX') {
        ticker = '^GSPC';
    }

    const container = document.getElementById('search-result-container');
    const nameEl = document.getElementById('result-name');
    const valueEl = document.getElementById('result-value');
    const changeEl = document.getElementById('result-change');
    const ctx = document.getElementById('resultChart').getContext('2d');

    container.style.display = 'block';
    
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`;
    
    const data = await fetchWithProxy(yahooUrl);
    
    if (data && data.chart && data.chart.result) {
        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0].close;
        const meta = result.meta;
        
        // Clean data: remove nulls and match with timestamps
        const cleanData = [];
        const cleanLabels = [];
        
        if (timestamps) {
            timestamps.forEach((ts, i) => {
                if (quotes[i] !== null) {
                    cleanData.push(quotes[i]);
                    const date = new Date(ts * 1000);
                    // Format label based on range
                    if (range === '1d') {
                        cleanLabels.push(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                    } else {
                        cleanLabels.push(date.toLocaleDateString([], { month: 'short', day: 'numeric', year: range.includes('y') ? '2-digit' : undefined }));
                    }
                }
            });
        }

        if (cleanData.length > 0) {
            const currentPrice = cleanData[cleanData.length - 1];
            const initialPrice = cleanData[0];
            const diff = currentPrice - initialPrice;
            const percent = initialPrice !== 0 ? (diff / initialPrice) * 100 : 0;
            const color = diff >= 0 ? '#00ffa3' : '#ff4d4d';

            // Clean up name
            let cleanName = meta.longName || meta.shortName || meta.symbol;
            cleanName = cleanName.replace(/ (Co\., Ltd\.|Corporation|Inc\.|Ltd\.|PLC|Common Stock)/gi, '').trim();

            nameEl.innerHTML = `<span class="ticker-label">${meta.symbol}</span> <span class="company-name">${cleanName}</span>`;
            valueEl.innerText = currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            changeEl.innerText = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} (${percent.toFixed(2)}%)`;
            changeEl.className = `index-change ${diff >= 0 ? 'up' : 'down'}`;

            if (resultChart) resultChart.destroy();

            resultChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: cleanLabels,
                    datasets: [{
                        data: cleanData,
                        borderColor: color,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        fill: true,
                        backgroundColor: createGradient(ctx, color),
                        tension: 0.2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(20, 22, 28, 0.9)',
                            titleColor: '#a0a0a0',
                            bodyColor: '#ffffff',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: false,
                            callbacks: {
                                label: function(context) {
                                    return `Price: ${context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                                }
                            }
                        }
                    },
                    scales: { 
                        x: { 
                            display: true, 
                            grid: { display: false },
                            ticks: { 
                                color: '#606060', 
                                maxRotation: 0, 
                                autoSkip: true,
                                maxTicksLimit: 8
                            }
                        }, 
                        y: { 
                            display: true, 
                            grid: { color: 'rgba(255,255,255,0.05)' }, 
                            ticks: { color: '#a0a0a0', font: { size: 10 } } 
                        } 
                    }
                }
            });
        } else {
            valueEl.innerText = 'N/A';
            changeEl.innerText = '데이터 없음';
            if (resultChart) {
                resultChart.destroy();
                resultChart = null;
            }
        }
    } else {
        nameEl.innerText = `Error: Data fetching failed for ${ticker}`;
    }
}

// Event listeners for range buttons
document.getElementById('result-range-selector').addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        const buttons = document.querySelectorAll('#result-range-selector button');
        buttons.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        const range = e.target.getAttribute('data-range');
        const interval = e.target.getAttribute('data-interval');
        searchTicker(range, interval);
    }
});

window.addEventListener('DOMContentLoaded', () => {
    initCharts().then(() => {
        setInterval(refreshAllData, 60000);
        setInterval(() => {
            for (const key in indices) {
                const index = indices[key];
                if (index.currentPrice) {
                    const tick = (Math.random() - 0.5) * (index.currentPrice * 0.0001);
                    index.currentPrice += tick;
                    updateUI(key);
                }
            }
        }, 2000);
    });

    document.getElementById('search-btn').addEventListener('click', () => {
        currentTicker = ''; // Reset ticker to use input
        searchTicker('5y', '1mo');
    });
    
    document.getElementById('ticker-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentTicker = '';
            searchTicker('5y', '1mo');
        }
    });
});
