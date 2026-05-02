const indices = {
    kospi: { symbol: '^KS11', id: 'kospiChart', valueId: 'kospi-value', changeId: 'kospi-change', data: [], color: '#00ffa3', fallback: 2750 },
    kosdaq: { symbol: '^KQ11', id: 'kosdaqChart', valueId: 'kosdaq-value', changeId: 'kosdaq-change', data: [], color: '#ff4d4d', fallback: 850 },
    nasdaq: { symbol: '^IXIC', id: 'nasdaqChart', valueId: 'nasdaq-value', changeId: 'nasdaq-change', data: [], color: '#00ffa3', fallback: 16500 },
    sp500: { symbol: '^GSPC', id: 'sp500Chart', valueId: 'sp500-value', changeId: 'sp500-change', data: [], color: '#00ffa3', fallback: 5200 }
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
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${index.symbol}?interval=5m&range=1d`;
    
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

async function searchTicker() {
    const input = document.getElementById('ticker-input');
    const exchangeSelect = document.getElementById('exchange-select');
    let ticker = input.value.trim().toUpperCase();
    const exchange = exchangeSelect.value;

    if (!ticker) return;

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
    nameEl.innerText = `Searching for ${ticker}...`;

    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=5m&range=1d`;
    
    const data = await fetchWithProxy(yahooUrl);
    
    if (data && data.chart && data.chart.result) {
        const result = data.chart.result[0];
        const quote = result.indicators.quote[0].close.filter(val => val !== null);
        const meta = result.meta;
        const currentPrice = meta.regularMarketPrice;
        const prevClose = meta.previousClose;
        const diff = currentPrice - prevClose;
        const percent = (diff / prevClose) * 100;
        const color = diff > 0 ? '#00ffa3' : '#ff4d4d';

        nameEl.innerText = `${meta.symbol} (${meta.longName || meta.shortName || meta.symbol})`;
        valueEl.innerText = currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        changeEl.innerText = `${diff > 0 ? '+' : ''}${diff.toFixed(2)} (${percent.toFixed(2)}%)`;
        changeEl.className = `index-change ${diff > 0 ? 'up' : 'down'}`;

        if (resultChart) resultChart.destroy();

        resultChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(quote.length).fill(''),
                datasets: [{
                    data: quote,
                    borderColor: color,
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    backgroundColor: createGradient(ctx, color),
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    x: { display: false }, 
                    y: { display: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0a0a0' } } 
                }
            }
        });
    } else {
        nameEl.innerText = `Error: ${ticker}를 찾을 수 없거나 데이터 통신에 실패했습니다.`;
        valueEl.innerText = '0.00';
        changeEl.innerText = '0.00 (0.00%)';
        if (resultChart) {
            resultChart.destroy();
            resultChart = null;
        }
    }
}

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

    document.getElementById('search-btn').addEventListener('click', searchTicker);
    document.getElementById('ticker-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchTicker();
    });
});
