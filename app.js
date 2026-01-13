// ==========================================
// Tennis Hub - 主应用逻辑
// ==========================================

// ==========================================
// API 配置 - 使用 Cloudflare Worker 代理
// ==========================================
// 数据来源: Ultimate Tennis Statistics (免费实时 ATP 排名)
const API_CONFIG = {
    workerUrl: 'https://tennis-api.muia93.workers.dev',
    enabled: true
};

// 国家代码转国旗 emoji
const COUNTRY_FLAGS = {
    'Spain': '🇪🇸', 'Italy': '🇮🇹', 'Serbia': '🇷🇸', 'Russia': '🇷🇺',
    'Germany': '🇩🇪', 'Poland': '🇵🇱', 'Norway': '🇳🇴', 'USA': '🇺🇸',
    'Greece': '🇬🇷', 'France': '🇫🇷', 'Switzerland': '🇨🇭', 'Australia': '🇦🇺',
    'Great Britain': '🇬🇧', 'Canada': '🇨🇦', 'Argentina': '🇦🇷', 'China': '🇨🇳',
    'Japan': '🇯🇵', 'Czech Republic': '🇨🇿', 'Belarus': '🇧🇾', 'Kazakhstan': '🇰🇿',
    'Tunisia': '🇹🇳', 'Croatia': '🇭🇷', 'Belgium': '🇧🇪', 'Denmark': '🇩🇰',
    'Bulgaria': '🇧🇬', 'United Kingdom': '🇬🇧', 'Netherlands': '🇳🇱', 'Brazil': '🇧🇷'
};

// API 数据获取模块 - 使用 Worker 代理
const TennisAPI = {
    // 获取 ATP 排名
    async getATPRankings() {
        if (!API_CONFIG.enabled) return null;
        try {
            const url = `${API_CONFIG.workerUrl}/rankings/atp`;
            console.log('Fetching ATP rankings from Worker...');
            const response = await fetch(url);
            const data = await response.json();
            console.log('Worker Response:', data);
            if (data.result && data.success) {
                // Worker 返回的格式：{rank, name, country, flag, points, change}
                return data.result.slice(0, 20).map(player => ({
                    rank: player.rank,
                    name: player.name || 'Unknown',
                    country: player.country || 'Unknown',
                    flag: player.flag || '🏳️',
                    points: player.points || 0,
                    change: player.change || 0
                }));
            }
        } catch (error) {
            console.log('API 请求失败，使用模拟数据:', error);
        }
        return null;
    },

    // 获取 WTA 排名
    async getWTARankings() {
        if (!API_CONFIG.enabled) return null;
        try {
            const url = `${API_CONFIG.workerUrl}/rankings/wta`;
            console.log('Fetching WTA rankings from Worker...');
            const response = await fetch(url);
            const data = await response.json();
            console.log('WTA Worker Response:', data);
            if (data.result && data.success) {
                // Worker 返回的格式：{rank, name, country, flag, points, change}
                return data.result.slice(0, 20).map(player => ({
                    rank: player.rank,
                    name: player.name || 'Unknown',
                    country: player.country || 'Unknown',
                    flag: player.flag || '🏳️',
                    points: player.points || 0,
                    change: player.change || 0
                }));
            }
        } catch (error) {
            console.log('API 请求失败，使用模拟数据:', error);
        }
        return null;
    },

    // 获取比赛数据
    async getLiveMatches() {
        if (!API_CONFIG.enabled) return null;
        try {
            const url = `${API_CONFIG.workerUrl}/matches`;
            console.log('Fetching matches from Worker...');
            const response = await fetch(url);
            const data = await response.json();
            console.log('Matches Worker Response:', data);
            if (data.result && data.result.length > 0) {
                return data.result.slice(0, 10).map(match => ({
                    id: match.event_key,
                    tournament: match.league_name || 'ATP/WTA Tour',
                    category: match.league_name?.includes('Grand') ? '大满贯' : 'ATP/WTA',
                    status: match.event_status === 'Finished' ? 'finished' :
                        match.event_status === 'Live' ? 'live' : 'upcoming',
                    player1: {
                        name: match.event_first_player || 'TBD',
                        country: COUNTRY_FLAGS[match.first_player_country] || '🏳️'
                    },
                    player2: {
                        name: match.event_second_player || 'TBD',
                        country: COUNTRY_FLAGS[match.second_player_country] || '🏳️'
                    },
                    score: match.event_final_result || 'vs',
                    time: match.event_time || match.event_date || 'TBD'
                }));
            }
        } catch (error) {
            console.log('API 请求失败，使用模拟数据:', error);
        }
        return null;
    },

    // 获取 H2H 数据
    async getH2H(player1Name, player2Name) {
        if (!API_CONFIG.enabled) return null;
        try {
            const url = `${API_CONFIG.workerUrl}/h2h?player1=${encodeURIComponent(player1Name)}&player2=${encodeURIComponent(player2Name)}`;
            console.log('Fetching H2H from Worker...');
            const response = await fetch(url);
            const data = await response.json();
            if (data.result && data.result.H2H) {
                const h2h = data.result.H2H;
                return {
                    player1Wins: parseInt(h2h.player1_wins) || 0,
                    player2Wins: parseInt(h2h.player2_wins) || 0,
                    matches: (data.result.last_matches || []).slice(0, 5).map(m => ({
                        event: m.league_name || 'ATP/WTA',
                        winner: m.event_winner === '1' ? 1 : 2,
                        score: m.event_final_result || '-'
                    }))
                };
            }
        } catch (error) {
            console.log('API 请求失败，使用模拟数据:', error);
        }
        return null;
    }
};

// 缓存管理
const DataCache = {
    cache: {},
    ttl: 5 * 60 * 1000, // 5分钟缓存

    get(key) {
        const item = this.cache[key];
        if (item && Date.now() - item.timestamp < this.ttl) {
            return item.data;
        }
        return null;
    },

    set(key, data) {
        this.cache[key] = { data, timestamp: Date.now() };
    }
};

// 模拟数据 (基于 2026年1月 ATP/WTA 官方排名)
const DATA = {
    // ATP排名数据 (来源: ATP官网 2026-01-12)
    atpRankings: [
        { rank: 1, name: "卡洛斯·阿尔卡拉斯", country: "西班牙", flag: "🇪🇸", points: 12050, change: 0 },
        { rank: 2, name: "扬尼克·辛纳", country: "意大利", flag: "🇮🇹", points: 11500, change: 0 },
        { rank: 3, name: "亚历山大·兹维列夫", country: "德国", flag: "��", points: 5105, change: 0 },
        { rank: 4, name: "诺瓦克·德约科维奇", country: "塞尔维亚", flag: "🇷�", points: 4780, change: 0 },
        { rank: 5, name: "洛伦佐·穆塞蒂", country: "意大利", flag: "��", points: 4105, change: 2 },
        { rank: 6, name: "泰勒·弗里茨", country: "美国", flag: "🇸", points: 3900, change: 0 },
        { rank: 7, name: "卡斯帕·鲁德", country: "挪威", flag: "��", points: 3855, change: 0 },
        { rank: 8, name: "阿莱克斯·德米诺尔", country: "澳大利亚", flag: "��", points: 3735, change: 0 },
        { rank: 9, name: "安德烈·卢布列夫", country: "俄罗斯", flag: "🇷🇺", points: 3520, change: 0 },
        { rank: 10, name: "格里戈尔·迪米特洛夫", country: "保加利亚", flag: "🇧🇬", points: 3300, change: 0 }
    ],

    // WTA排名数据
    wtaRankings: [
        { rank: 1, name: "伊加·斯维亚特克", country: "波兰", flag: "🇵🇱", points: 10835, change: 0 },
        { rank: 2, name: "阿丽娜·萨巴伦卡", country: "白俄罗斯", flag: "🇧🇾", points: 8770, change: 0 },
        { rank: 3, name: "科科·高芙", country: "美国", flag: "🇺🇸", points: 6988, change: 1 },
        { rank: 4, name: "埃莱娜·雷巴金娜", country: "哈萨克斯坦", flag: "🇰🇿", points: 5873, change: -1 },
        { rank: 5, name: "杰西卡·佩古拉", country: "美国", flag: "🇺🇸", points: 5350, change: 2 },
        { rank: 6, name: "玛丽亚·萨卡里", country: "希腊", flag: "🇬🇷", points: 4790, change: 1 },
        { rank: 7, name: "郑钦文", country: "中国", flag: "🇨🇳", points: 4455, change: 4 },
        { rank: 8, name: "昂斯·贾贝尔", country: "突尼斯", flag: "🇹🇳", points: 4061, change: -3 },
        { rank: 9, name: "卡罗琳·加西亚", country: "法国", flag: "🇫🇷", points: 3650, change: -1 },
        { rank: 10, name: "贝琳达·本西奇", country: "瑞士", flag: "🇨🇭", points: 3420, change: 0 }
    ],

    // 赛程数据
    schedule: [
        {
            id: 1,
            tournament: "澳大利亚网球公开赛",
            category: "大满贯",
            status: "live",
            player1: { name: "阿尔卡拉斯", country: "🇪🇸" },
            player2: { name: "辛纳", country: "🇮🇹" },
            score: "6-4 3-6 6-2",
            time: "进行中 - 第三盘"
        },
        {
            id: 2,
            tournament: "澳大利亚网球公开赛",
            category: "大满贯",
            status: "finished",
            player1: { name: "德约科维奇", country: "🇷🇸" },
            player2: { name: "梅德韦杰夫", country: "🇷🇺" },
            score: "6-3 6-1 6-4",
            time: "已结束"
        },
        {
            id: 3,
            tournament: "澳大利亚网球公开赛",
            category: "大满贯",
            status: "upcoming",
            player1: { name: "斯维亚特克", country: "🇵🇱" },
            player2: { name: "高芙", country: "🇺🇸" },
            score: "vs",
            time: "1月13日 15:00"
        },
        {
            id: 4,
            tournament: "ATP 250 阿德莱德",
            category: "ATP 250",
            status: "upcoming",
            player1: { name: "兹维列夫", country: "🇩🇪" },
            player2: { name: "卢布列夫", country: "🇷🇺" },
            score: "vs",
            time: "1月14日 11:00"
        },
        {
            id: 5,
            tournament: "WTA 500 阿德莱德",
            category: "WTA 500",
            status: "finished",
            player1: { name: "郑钦文", country: "🇨🇳" },
            player2: { name: "萨巴伦卡", country: "🇧🇾" },
            score: "7-6 4-6 7-5",
            time: "已结束"
        }
    ],

    // 新闻数据
    news: [
        {
            id: 1,
            category: "大满贯",
            title: "阿尔卡拉斯与辛纳上演史诗对决",
            excerpt: "两位年轻天才在澳网半决赛展开激烈对决，比赛充满精彩回合和高水平竞技。",
            image: "🎾",
            date: "2026-01-12",
            author: "Tennis Hub"
        },
        {
            id: 2,
            category: "球员动态",
            title: "郑钦文连胜势头强劲，排名飙升",
            excerpt: "中国金花郑钦文近期状态火热，在阿德莱德500赛事中连克强敌，世界排名创新高。",
            image: "🏆",
            date: "2026-01-11",
            author: "Tennis Hub"
        },
        {
            id: 3,
            category: "装备资讯",
            title: "Wilson最新Pro Staff系列发布",
            excerpt: "Wilson正式发布新款Pro Staff系列球拍，采用全新科技提升控制性能。",
            image: "🎯",
            date: "2026-01-10",
            author: "Tennis Hub"
        },
        {
            id: 4,
            category: "赛事预告",
            title: "澳网进入最后阶段，决赛即将开战",
            excerpt: "2026年澳大利亚网球公开赛即将迎来巅峰对决，男女单打决赛蓄势待发。",
            image: "🏟️",
            date: "2026-01-12",
            author: "Tennis Hub"
        },
        {
            id: 5,
            category: "技术分析",
            title: "德约科维奇经典战术解析",
            excerpt: "深入解读天王德约科维奇的比赛战术，学习世界顶级球员的制胜之道。",
            image: "📊",
            date: "2026-01-09",
            author: "Tennis Hub"
        },
        {
            id: 6,
            category: "球员动态",
            title: "纳达尔退役后首次公开露面",
            excerpt: "红土之王纳达尔退役后接受专访，分享退役生活和对网球运动的热爱。",
            image: "👑",
            date: "2026-01-08",
            author: "Tennis Hub"
        }
    ],

    // 球员H2H数据
    players: [
        { id: 1, name: "卡洛斯·阿尔卡拉斯", country: "🇪🇸" },
        { id: 2, name: "扬尼克·辛纳", country: "🇮🇹" },
        { id: 3, name: "诺瓦克·德约科维奇", country: "🇷🇸" },
        { id: 4, name: "丹尼尔·梅德韦杰夫", country: "🇷🇺" },
        { id: 5, name: "亚历山大·兹维列夫", country: "🇩🇪" },
        { id: 6, name: "伊加·斯维亚特克", country: "🇵🇱" },
        { id: 7, name: "阿丽娜·萨巴伦卡", country: "🇧🇾" },
        { id: 8, name: "科科·高芙", country: "🇺🇸" }
    ],

    h2hData: {
        "1-2": {
            player1Wins: 5,
            player2Wins: 4,
            matches: [
                { event: "2025 ATP总决赛", winner: 1, score: "6-4 6-3" },
                { event: "2025 温网决赛", winner: 2, score: "6-7 7-5 6-3 7-6" },
                { event: "2025 法网半决赛", winner: 1, score: "6-3 6-4 6-2" },
                { event: "2024 澳网决赛", winner: 2, score: "6-4 7-5 6-4" },
                { event: "2024 美网半决赛", winner: 1, score: "7-6 6-4 6-3" }
            ]
        },
        "1-3": {
            player1Wins: 3,
            player2Wins: 4,
            matches: [
                { event: "2025 温网半决赛", winner: 1, score: "6-4 6-4 6-3" },
                { event: "2024 法网决赛", winner: 3, score: "6-7 6-4 7-5 6-4" },
                { event: "2023 温网决赛", winner: 1, score: "1-6 7-6 6-1 3-6 6-4" }
            ]
        },
        "3-4": {
            player1Wins: 11,
            player2Wins: 5,
            matches: [
                { event: "2025 澳网决赛", winner: 3, score: "6-3 6-3 6-2" },
                { event: "2024 美网决赛", winner: 4, score: "6-4 6-4 6-4" },
                { event: "2023 澳网决赛", winner: 3, score: "7-5 6-3 7-6" }
            ]
        },
        "6-7": {
            player1Wins: 7,
            player2Wins: 4,
            matches: [
                { event: "2025 法网决赛", winner: 6, score: "6-2 6-1" },
                { event: "2025 马德里决赛", winner: 7, score: "7-5 6-4" },
                { event: "2024 美网半决赛", winner: 6, score: "6-3 6-1" }
            ]
        }
    },

    // 装备数据
    equipment: {
        rackets: [
            { id: 1, brand: "Wilson", name: "Pro Staff 97 V14", specs: "97平方英寸 | 315g | 16x19", icon: "🎾", avgRating: 4.8, ratingCount: 256 },
            { id: 2, brand: "Head", name: "Speed Pro", specs: "100平方英寸 | 310g | 18x20", icon: "🎾", avgRating: 4.7, ratingCount: 189 },
            { id: 3, brand: "Babolat", name: "Pure Aero", specs: "100平方英寸 | 300g | 16x19", icon: "🎾", avgRating: 4.6, ratingCount: 342 },
            { id: 4, brand: "Yonex", name: "EZONE 100", specs: "100平方英寸 | 300g | 16x19", icon: "🎾", avgRating: 4.5, ratingCount: 178 },
            { id: 5, brand: "Tecnifibre", name: "TF40", specs: "98平方英寸 | 305g | 18x20", icon: "🎾", avgRating: 4.4, ratingCount: 92 },
            { id: 6, brand: "Dunlop", name: "CX 200 Tour", specs: "95平方英寸 | 310g | 18x20", icon: "🎾", avgRating: 4.3, ratingCount: 67 }
        ],
        shoes: [
            { id: 7, brand: "Nike", name: "Air Zoom Vapor Pro 2", specs: "硬地 | 轻量化设计", icon: "👟", avgRating: 4.9, ratingCount: 423 },
            { id: 8, brand: "Asics", name: "Gel Resolution 9", specs: "全场地 | 稳定支撑", icon: "👟", avgRating: 4.8, ratingCount: 356 },
            { id: 9, brand: "Adidas", name: "Barricade 2026", specs: "硬地 | 耐久性", icon: "👟", avgRating: 4.7, ratingCount: 289 },
            { id: 10, brand: "New Balance", name: "Fresh Foam LAV", specs: "全场地 | 舒适缓震", icon: "👟", avgRating: 4.6, ratingCount: 145 }
        ],
        apparel: [
            { id: 11, brand: "Nike", name: "Dri-FIT Advantage 套装", specs: "透气速干 | 弹性面料", icon: "👕", avgRating: 4.7, ratingCount: 198 },
            { id: 12, brand: "Adidas", name: "Melbourne 系列", specs: "可持续材料 | 时尚设计", icon: "👕", avgRating: 4.6, ratingCount: 167 },
            { id: 13, brand: "Lacoste", name: "经典网球 Polo", specs: "棉质混纺 | 经典版型", icon: "👕", avgRating: 4.5, ratingCount: 134 },
            { id: 14, brand: "Uniqlo", name: "DRY-EX 运动T恤", specs: "轻量透气 | 性价比高", icon: "👕", avgRating: 4.4, ratingCount: 278 }
        ],
        strings: [
            { id: 15, brand: "Luxilon", name: "ALU Power", specs: "聚酯 | 1.25mm", icon: "🧵", avgRating: 4.8, ratingCount: 512 },
            { id: 16, brand: "Babolat", name: "RPM Blast", specs: "聚酯 | 1.25mm", icon: "🧵", avgRating: 4.7, ratingCount: 467 },
            { id: 17, brand: "Wilson", name: "Natural Gut", specs: "天然肠线 | 1.30mm", icon: "🧵", avgRating: 4.9, ratingCount: 234 },
            { id: 18, brand: "Yonex", name: "Poly Tour Pro", specs: "聚酯 | 1.25mm", icon: "🧵", avgRating: 4.5, ratingCount: 156 }
        ]
    }
};

// 用户评分管理
const RatingManager = {
    getKey: (itemId) => `tennis_hub_rating_${itemId}`,

    getUserRating: (itemId) => {
        return parseInt(localStorage.getItem(RatingManager.getKey(itemId))) || 0;
    },

    setUserRating: (itemId, rating) => {
        localStorage.setItem(RatingManager.getKey(itemId), rating);
    },

    getAllRatings: () => {
        const ratings = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('tennis_hub_rating_')) {
                const itemId = key.replace('tennis_hub_rating_', '');
                ratings[itemId] = parseInt(localStorage.getItem(key));
            }
        }
        return ratings;
    }
};

// 应用状态
const App = {
    currentPage: 'home',
    currentRankingType: 'atp',
    currentEquipmentType: 'rackets',
    selectedPlayer1: 1,
    selectedPlayer2: 2,

    init() {
        this.setupNavigation();
        this.setupMobileMenu();
        this.renderPage('home');
    },

    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    setupMobileMenu() {
        const toggle = document.getElementById('mobile-toggle');
        const menu = document.getElementById('nav-menu');

        toggle.addEventListener('click', () => {
            menu.classList.toggle('active');
        });

        // 点击导航项后关闭菜单
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                menu.classList.remove('active');
            });
        });
    },

    navigateTo(page) {
        this.currentPage = page;

        // 更新导航状态
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        this.renderPage(page);
    },

    async renderPage(page) {
        const content = document.getElementById('main-content');

        switch (page) {
            case 'home':
                content.innerHTML = this.renderHome();
                this.setupHomeEvents();
                break;
            case 'rankings':
                content.innerHTML = this.renderLoading('正在加载排名数据...');
                const rankingsHtml = await this.renderRankings();
                content.innerHTML = rankingsHtml;
                this.setupRankingsEvents();
                break;
            case 'schedule':
                content.innerHTML = this.renderLoading('正在加载赛程数据...');
                const scheduleHtml = await this.renderSchedule();
                content.innerHTML = scheduleHtml;
                break;
            case 'news':
                content.innerHTML = this.renderNews();
                break;
            case 'h2h':
                content.innerHTML = this.renderH2H();
                this.setupH2HEvents();
                break;
            case 'equipment':
                content.innerHTML = this.renderEquipment();
                this.setupEquipmentEvents();
                break;
        }
    },

    // 首页渲染
    renderHome() {
        return `
            <section class="hero">
                <h2>欢迎来到 <span class="gradient-text">Tennis Hub</span></h2>
                <p>您的一站式网球信息平台，提供实时排名、赛程赛果、球员对战数据和装备评测</p>
                
                <div class="hero-stats">
                    <div class="stat-item fade-in-up">
                        <div class="stat-number">500+</div>
                        <div class="stat-label">职业球员</div>
                    </div>
                    <div class="stat-item fade-in-up">
                        <div class="stat-number">60+</div>
                        <div class="stat-label">赛事覆盖</div>
                    </div>
                    <div class="stat-item fade-in-up">
                        <div class="stat-number">100+</div>
                        <div class="stat-label">装备评测</div>
                    </div>
                </div>
                
                <div class="feature-grid">
                    <div class="feature-card fade-in-up" data-page="rankings">
                        <span class="feature-icon">🏆</span>
                        <h3>ATP/WTA 排名</h3>
                        <p>实时更新的世界排名，追踪您喜爱球员的排名变化</p>
                    </div>
                    <div class="feature-card fade-in-up" data-page="schedule">
                        <span class="feature-icon">📅</span>
                        <h3>赛程赛果</h3>
                        <p>全面的赛事日程和实时比分，不错过任何精彩比赛</p>
                    </div>
                    <div class="feature-card fade-in-up" data-page="news">
                        <span class="feature-icon">📰</span>
                        <h3>新闻资讯</h3>
                        <p>最新网球新闻、球员动态和赛事分析</p>
                    </div>
                    <div class="feature-card fade-in-up" data-page="h2h">
                        <span class="feature-icon">⚔️</span>
                        <h3>H2H 对战</h3>
                        <p>查看任意两位球员之间的历史对战记录</p>
                    </div>
                    <div class="feature-card fade-in-up" data-page="equipment">
                        <span class="feature-icon">🎾</span>
                        <h3>装备库</h3>
                        <p>球拍、球鞋、球衣、球线全方位评测和用户评分</p>
                    </div>
                    <div class="feature-card fade-in-up" data-page="rankings">
                        <span class="feature-icon">📊</span>
                        <h3>数据统计</h3>
                        <p>深入的球员数据分析和表现统计</p>
                    </div>
                </div>
            </section>
        `;
    },

    setupHomeEvents() {
        document.querySelectorAll('.feature-card').forEach(card => {
            card.addEventListener('click', () => {
                const page = card.dataset.page;
                if (page) this.navigateTo(page);
            });
        });
    },

    // 加载状态
    renderLoading(message = '加载中...') {
        return `
            <div class="page-header" style="padding: 100px 0; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px; animation: bounce 1s infinite;">🎾</div>
                <p style="color: var(--text-secondary); font-size: 18px;">${message}</p>
                <p style="color: var(--text-muted); font-size: 14px; margin-top: 10px;">
                    ${API_CONFIG.enabled ? '正在从 API-Tennis 获取数据...' : '使用演示数据'}
                </p>
            </div>
        `;
    },

    // 排名页面
    async renderRankings() {
        // 尝试从 API 获取真实数据
        let rankings;
        if (this.currentRankingType === 'atp') {
            const cached = DataCache.get('atp_rankings');
            if (cached) {
                rankings = cached;
            } else {
                const apiData = await TennisAPI.getATPRankings();
                if (apiData) {
                    rankings = apiData;
                    DataCache.set('atp_rankings', apiData);
                } else {
                    rankings = DATA.atpRankings;
                }
            }
        } else {
            const cached = DataCache.get('wta_rankings');
            if (cached) {
                rankings = cached;
            } else {
                const apiData = await TennisAPI.getWTARankings();
                if (apiData) {
                    rankings = apiData;
                    DataCache.set('wta_rankings', apiData);
                } else {
                    rankings = DATA.wtaRankings;
                }
            }
        }

        const dataSource = API_CONFIG.enabled ? '数据来源: API-Tennis (实时)' : '演示数据 - 启用 API 获取实时排名';

        return `
            <div class="page-header">
                <h2>🏆 世界排名</h2>
                <p>ATP 和 WTA 最新官方排名</p>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">${dataSource}</p>
            </div>
            
            <div class="tabs">
                <button class="tab-btn ${this.currentRankingType === 'atp' ? 'active' : ''}" data-type="atp">ATP 男子</button>
                <button class="tab-btn ${this.currentRankingType === 'wta' ? 'active' : ''}" data-type="wta">WTA 女子</button>
            </div>
            
            <div class="rankings-table">
                <div class="table-header">
                    <span>排名</span>
                    <span>球员</span>
                    <span>国家/地区</span>
                    <span>积分</span>
                    <span>变化</span>
                </div>
                ${rankings.map(player => `
                    <div class="table-row fade-in-up">
                        <span class="rank-number ${player.rank <= 3 ? 'top-3' : ''}">${player.rank}</span>
                        <div class="player-info">
                            <div class="player-avatar">${player.name.charAt(0)}</div>
                            <div>
                                <div class="player-name">${player.name}</div>
                            </div>
                        </div>
                        <div class="player-country">
                            <span>${player.flag}</span>
                            <span>${player.country}</span>
                        </div>
                        <span class="points">${player.points.toLocaleString()}</span>
                        <span class="change ${player.change > 0 ? 'up' : player.change < 0 ? 'down' : 'same'}">
                            ${player.change > 0 ? '▲ ' + player.change : player.change < 0 ? '▼ ' + Math.abs(player.change) : '−'}
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
    },

    setupRankingsEvents() {
        document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentRankingType = btn.dataset.type;
                this.renderPage('rankings');
            });
        });
    },

    // 赛程页面
    async renderSchedule() {
        // 尝试从 API 获取真实数据
        let schedule;
        const cached = DataCache.get('schedule');
        if (cached) {
            schedule = cached;
        } else {
            const apiData = await TennisAPI.getLiveMatches();
            if (apiData && apiData.length > 0) {
                schedule = apiData;
                DataCache.set('schedule', apiData);
            } else {
                schedule = DATA.schedule;
            }
        }

        const dataSource = API_CONFIG.enabled ? '数据来源: API-Tennis (实时)' : '演示数据 - 启用 API 获取实时赛程';

        return `
            <div class="page-header">
                <h2>📅 赛程赛果</h2>
                <p>最新比赛日程和实时比分</p>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">${dataSource}</p>
            </div>
            
            <div class="schedule-grid">
                ${schedule.map(match => `
                    <div class="match-card fade-in-up">
                        <div class="match-header">
                            <div class="tournament-info">
                                <span class="tournament-badge">${match.category}</span>
                                <span class="tournament-name">${match.tournament}</span>
                            </div>
                            <span class="match-status ${match.status}">${match.status === 'live' ? '🔴 直播' :
                match.status === 'finished' ? '已结束' : '即将开始'
            }</span>
                        </div>
                        <div class="match-players">
                            <div class="match-player">
                                <div class="match-player-name">${match.player1.name}</div>
                                <div class="match-player-country">${match.player1.country}</div>
                            </div>
                            <div class="match-score">${match.score}</div>
                            <div class="match-player">
                                <div class="match-player-name">${match.player2.name}</div>
                                <div class="match-player-country">${match.player2.country}</div>
                            </div>
                        </div>
                        <div class="match-time">⏰ ${match.time}</div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // 新闻页面
    renderNews() {
        return `
            <div class="page-header">
                <h2>📰 新闻资讯</h2>
                <p>最新网球动态和深度报道</p>
            </div>
            
            <div class="news-grid">
                ${DATA.news.map(article => `
                    <article class="news-card fade-in-up">
                        <div class="news-image">${article.image}</div>
                        <div class="news-content">
                            <span class="news-category">${article.category}</span>
                            <h3 class="news-title">${article.title}</h3>
                            <p class="news-excerpt">${article.excerpt}</p>
                            <div class="news-meta">
                                <span>${article.author}</span>
                                <span>${article.date}</span>
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>
        `;
    },

    // H2H页面
    renderH2H() {
        const player1 = DATA.players.find(p => p.id === this.selectedPlayer1);
        const player2 = DATA.players.find(p => p.id === this.selectedPlayer2);

        const h2hKey = `${Math.min(this.selectedPlayer1, this.selectedPlayer2)}-${Math.max(this.selectedPlayer1, this.selectedPlayer2)}`;
        const h2hData = DATA.h2hData[h2hKey];

        return `
            <div class="page-header">
                <h2>⚔️ H2H 对战记录</h2>
                <p>选择两位球员查看历史对战</p>
            </div>
            
            <div class="h2h-container">
                <div class="player-selector">
                    <div class="player-select-card">
                        <div style="font-size: 64px; margin-bottom: 12px;">${player1.country}</div>
                        <div style="font-size: 18px; font-weight: 700;">${player1.name}</div>
                        <select id="player1-select">
                            ${DATA.players.map(p => `
                                <option value="${p.id}" ${p.id === this.selectedPlayer1 ? 'selected' : ''}>
                                    ${p.country} ${p.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="vs-badge">VS</div>
                    
                    <div class="player-select-card">
                        <div style="font-size: 64px; margin-bottom: 12px;">${player2.country}</div>
                        <div style="font-size: 18px; font-weight: 700;">${player2.name}</div>
                        <select id="player2-select">
                            ${DATA.players.map(p => `
                                <option value="${p.id}" ${p.id === this.selectedPlayer2 ? 'selected' : ''}>
                                    ${p.country} ${p.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                
                ${h2hData ? `
                    <div class="h2h-stats">
                        <div class="h2h-score">
                            <div class="h2h-player-score">
                                <div class="h2h-player-name">${player1.name}</div>
                                <div class="h2h-wins">${this.selectedPlayer1 < this.selectedPlayer2 ? h2hData.player1Wins : h2hData.player2Wins}</div>
                            </div>
                            <div class="h2h-dash">-</div>
                            <div class="h2h-player-score">
                                <div class="h2h-player-name">${player2.name}</div>
                                <div class="h2h-wins">${this.selectedPlayer1 < this.selectedPlayer2 ? h2hData.player2Wins : h2hData.player1Wins}</div>
                            </div>
                        </div>
                        
                        <div class="h2h-matches">
                            <h3>近期对战</h3>
                            ${h2hData.matches.map(match => {
            const winnerId = this.selectedPlayer1 < this.selectedPlayer2 ?
                (match.winner === 1 ? this.selectedPlayer1 : this.selectedPlayer2) :
                (match.winner === 1 ? this.selectedPlayer2 : this.selectedPlayer1);
            const winner = DATA.players.find(p => p.id === winnerId);
            return `
                                    <div class="h2h-match-item">
                                        <span class="h2h-match-event">${match.event}</span>
                                        <span class="h2h-match-result">🏆 ${winner.name}</span>
                                        <span class="h2h-match-score">${match.score}</span>
                                    </div>
                                `;
        }).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="h2h-stats" style="text-align: center; padding: 60px;">
                        <p style="color: var(--text-secondary); font-size: 18px;">暂无这两位球员的对战记录</p>
                        <p style="color: var(--text-muted); margin-top: 12px;">请选择其他球员组合</p>
                    </div>
                `}
            </div>
        `;
    },

    setupH2HEvents() {
        document.getElementById('player1-select').addEventListener('change', (e) => {
            this.selectedPlayer1 = parseInt(e.target.value);
            this.renderPage('h2h');
        });

        document.getElementById('player2-select').addEventListener('change', (e) => {
            this.selectedPlayer2 = parseInt(e.target.value);
            this.renderPage('h2h');
        });
    },

    // 装备页面
    renderEquipment() {
        const equipmentTypes = {
            rackets: '🎾 球拍',
            shoes: '👟 球鞋',
            apparel: '👕 球衣',
            strings: '🧵 球线'
        };

        const items = DATA.equipment[this.currentEquipmentType] || [];

        return `
            <div class="page-header">
                <h2>🎾 装备库</h2>
                <p>专业装备评测和用户评分</p>
            </div>
            
            <div class="tabs">
                ${Object.entries(equipmentTypes).map(([type, label]) => `
                    <button class="tab-btn ${this.currentEquipmentType === type ? 'active' : ''}" data-type="${type}">
                        ${label}
                    </button>
                `).join('')}
            </div>
            
            <div class="equipment-grid">
                ${items.map(item => {
            const userRating = RatingManager.getUserRating(item.id);
            return `
                        <div class="equipment-card fade-in-up">
                            <div class="equipment-image">${item.icon}</div>
                            <div class="equipment-content">
                                <div class="equipment-brand">${item.brand}</div>
                                <div class="equipment-name">${item.name}</div>
                                <div class="equipment-specs">${item.specs}</div>
                                <div class="equipment-rating">
                                    <div class="stars" data-item-id="${item.id}">
                                        ${[1, 2, 3, 4, 5].map(star => `
                                            <span class="star ${star <= userRating ? 'filled' : ''}" data-rating="${star}">
                                                ${star <= userRating ? '★' : '☆'}
                                            </span>
                                        `).join('')}
                                    </div>
                                    <div class="rating-info">
                                        <div class="rating-score">${item.avgRating.toFixed(1)}</div>
                                        <div class="rating-count">${item.ratingCount} 评分</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    },

    setupEquipmentEvents() {
        // 类型切换
        document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentEquipmentType = btn.dataset.type;
                this.renderPage('equipment');
            });
        });

        // 评分功能
        document.querySelectorAll('.stars').forEach(starsContainer => {
            const itemId = starsContainer.dataset.itemId;

            starsContainer.querySelectorAll('.star').forEach(star => {
                star.addEventListener('click', () => {
                    const rating = parseInt(star.dataset.rating);
                    RatingManager.setUserRating(itemId, rating);

                    // 更新显示
                    starsContainer.querySelectorAll('.star').forEach((s, idx) => {
                        const starRating = idx + 1;
                        s.classList.toggle('filled', starRating <= rating);
                        s.textContent = starRating <= rating ? '★' : '☆';
                    });
                });

                // 悬停效果
                star.addEventListener('mouseenter', () => {
                    const rating = parseInt(star.dataset.rating);
                    starsContainer.querySelectorAll('.star').forEach((s, idx) => {
                        const starRating = idx + 1;
                        if (starRating <= rating) {
                            s.style.color = 'var(--color-accent-light)';
                        }
                    });
                });

                star.addEventListener('mouseleave', () => {
                    const userRating = RatingManager.getUserRating(itemId);
                    starsContainer.querySelectorAll('.star').forEach((s, idx) => {
                        const starRating = idx + 1;
                        s.style.color = starRating <= userRating ? 'var(--color-accent)' : 'var(--text-muted)';
                    });
                });
            });
        });
    }
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
