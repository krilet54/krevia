/* ============================================
   KREVIA BLOG - Public Resources Logic
   ============================================ */

// Supabase Configuration
const BLOG_SUPABASE_URL = 'https://jmcquwcoxefbvwwglikn.supabase.co';
const BLOG_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptY3F1d2NveGVmYnZ3d2dsaWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjkyMDksImV4cCI6MjA5MDAwNTIwOX0.rQUOV2V0Gx31P9DmDRm0XflyY78Voaa_z9qo6leTvPw';

// Initialize Supabase client (use existing if available, otherwise create new)
const blogSupabase = window.blogSupabaseClient || window.supabase.createClient(BLOG_SUPABASE_URL, BLOG_SUPABASE_ANON_KEY);
window.blogSupabaseClient = blogSupabase;

const RESOURCE_TYPES = {
    article: {
        label: 'Article',
        defaultLabel: 'Field Note',
        cta: 'Read the article'
    },
    'customer-story': {
        label: 'Customer Story',
        defaultLabel: 'Growth Story',
        cta: 'Read the story'
    },
    press: {
        label: 'Press',
        defaultLabel: 'Press Note',
        cta: 'Read the update'
    }
};

const listingDom = {
    blogListing: document.getElementById('blog-listing'),
    blogSingle: document.getElementById('blog-single'),
    resourcesList: document.getElementById('resources-list') || document.getElementById('blog-grid'),
    blogLoading: document.getElementById('blog-loading'),
    blogEmpty: document.getElementById('blog-empty'),
    resultsSummary: document.getElementById('results-summary'),
    searchInput: document.getElementById('resource-search'),
    sortSelect: document.getElementById('resource-sort'),
    typePills: document.getElementById('type-pills'),
    featuredCarousel: document.getElementById('featured-carousel'),
    featuredTrack: document.getElementById('featured-track'),
    featuredDots: document.getElementById('featured-dots'),
    featuredPrev: document.getElementById('featured-prev'),
    featuredNext: document.getElementById('featured-next'),
    usesLegacyGrid: Boolean(document.getElementById('blog-grid') && !document.getElementById('resources-list'))
};

const state = {
    posts: [],
    filteredPosts: [],
    featuredPosts: [],
    activeType: 'all',
    searchTerm: '',
    sortBy: 'featured',
    activeSlide: 0,
    slideTimer: null
};

let blogInitialized = false;

function bootstrapBlog() {
    if (blogInitialized) return;
    blogInitialized = true;
    initBlog();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapBlog);
} else {
    bootstrapBlog();
}

async function initBlog() {
    const urlParams = new URLSearchParams(window.location.search);
    const postSlug = urlParams.get('post');

    if (postSlug) {
        await loadSinglePost(postSlug);
        return;
    }

    setupListingControls();
    await loadBlogListing();
}

function setupListingControls() {
    listingDom.searchInput?.addEventListener('input', (event) => {
        state.searchTerm = event.target.value.trim().toLowerCase();
        applyFiltersAndRender();
    });

    listingDom.sortSelect?.addEventListener('change', (event) => {
        state.sortBy = event.target.value;
        applyFiltersAndRender();
    });

    listingDom.typePills?.querySelectorAll('[data-type]').forEach((button) => {
        button.addEventListener('click', () => {
            state.activeType = button.dataset.type || 'all';
            updateTypePillState();
            applyFiltersAndRender();
        });
    });

    listingDom.featuredPrev?.addEventListener('click', () => goToSlide(state.activeSlide - 1));
    listingDom.featuredNext?.addEventListener('click', () => goToSlide(state.activeSlide + 1));

    listingDom.featuredCarousel?.addEventListener('mouseenter', stopSlideTimer);
    listingDom.featuredCarousel?.addEventListener('mouseleave', startSlideTimer);
}

async function loadBlogListing() {
    const resourceMount = ensureResourcesMount();

    listingDom.blogListing.style.display = 'block';
    listingDom.blogSingle.style.display = 'none';
    listingDom.blogLoading.style.display = 'block';
    resourceMount.innerHTML = '';
    listingDom.blogEmpty.style.display = 'none';

    try {
        const { data: posts, error } = await blogSupabase
            .from('posts')
            .select('id, title, slug, excerpt, cover_image_url, reading_time_minutes, published_at, content')
            .eq('status', 'published')
            .order('published_at', { ascending: false });

        listingDom.blogLoading.style.display = 'none';

        if (error) {
            console.error('Error fetching posts:', error);
            listingDom.blogEmpty.style.display = 'block';
            renderFeaturedFallback();
            return;
        }

        if (!posts || posts.length === 0) {
            listingDom.blogEmpty.style.display = 'block';
            listingDom.resultsSummary.textContent = '0 resources';
            renderFeaturedFallback();
            return;
        }

        state.posts = posts.map(normalizePost);
        state.featuredPosts = resolveFeaturedPosts(state.posts);

        try {
            renderFeaturedCarousel(state.featuredPosts);
        } catch (featuredError) {
            console.error('Featured render error:', featuredError);
        }

        try {
            applyFiltersAndRender();
        } catch (listingError) {
            console.error('Listing render error:', listingError);
            renderLegacyGrid(state.posts);
            updateResultsSummary(state.posts.length, state.posts.length);
        }

    } catch (error) {
        console.error('Error loading resources:', error);
        listingDom.blogLoading.style.display = 'none';
        listingDom.blogEmpty.style.display = 'block';
        renderFeaturedFallback();
    }
}

function ensureResourcesMount() {
    if (listingDom.resourcesList) {
        return listingDom.resourcesList;
    }

    const listingContainer = document.querySelector('#blog-listing .container:last-of-type') ||
        document.querySelector('#blog-listing .container');

    if (!listingContainer) {
        throw new Error('No resource listing container found');
    }

    const fallbackMount = document.createElement('div');
    fallbackMount.id = 'resources-list';
    fallbackMount.className = 'resources-list';
    listingContainer.appendChild(fallbackMount);
    listingDom.resourcesList = fallbackMount;

    return fallbackMount;
}

function normalizePost(post) {
    const resourceMeta = extractResourceMeta(post.content);

    return {
        ...post,
        resourceMeta,
        searchBlob: [
            post.title || '',
            post.excerpt || '',
            resourceMeta.label || '',
            resourceMeta.typeLabel || ''
        ].join(' ').toLowerCase()
    };
}

function extractResourceMeta(content) {
    const meta = content && typeof content === 'object' ? content.krevia_meta || {} : {};
    const contentType = normalizeContentType(meta.content_type);
    const typeInfo = RESOURCE_TYPES[contentType];
    const featuredSlot = normalizeFeaturedSlot(meta.featured_slot);
    const customLabel = typeof meta.resource_label === 'string' ? meta.resource_label.trim() : '';

    return {
        contentType,
        typeLabel: typeInfo.label,
        label: customLabel || typeInfo.defaultLabel,
        featuredSlot,
        featured: featuredSlot !== null
    };
}

function normalizeContentType(value) {
    return RESOURCE_TYPES[value] ? value : 'article';
}

function normalizeFeaturedSlot(value) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 5) {
        return null;
    }
    return number;
}

function resolveFeaturedPosts(posts) {
    const explicitFeatured = posts
        .filter((post) => post.resourceMeta.featured)
        .sort((a, b) => {
            if (a.resourceMeta.featuredSlot !== b.resourceMeta.featuredSlot) {
                return a.resourceMeta.featuredSlot - b.resourceMeta.featuredSlot;
            }
            return new Date(b.published_at) - new Date(a.published_at);
        })
        .slice(0, 5);

    if (explicitFeatured.length > 0) {
        return explicitFeatured;
    }

    return posts.slice(0, Math.min(posts.length, 5));
}

function applyFiltersAndRender() {
    const filtered = state.posts
        .filter((post) => state.activeType === 'all' || post.resourceMeta.contentType === state.activeType)
        .filter((post) => !state.searchTerm || post.searchBlob.includes(state.searchTerm))
        .sort(comparePosts);

    state.filteredPosts = filtered;

    renderResourceRows(filtered);
    updateResultsSummary(filtered.length, state.posts.length);
    updateTypePillState();

    if (typeof initScrollReveal === 'function') {
        initScrollReveal();
    }
}

function comparePosts(a, b) {
    if (state.sortBy === 'oldest') {
        return new Date(a.published_at) - new Date(b.published_at);
    }

    if (state.sortBy === 'newest') {
        return new Date(b.published_at) - new Date(a.published_at);
    }

    const aScore = a.resourceMeta.featured ? a.resourceMeta.featuredSlot : 999;
    const bScore = b.resourceMeta.featured ? b.resourceMeta.featuredSlot : 999;

    if (aScore !== bScore) {
        return aScore - bScore;
    }

    return new Date(b.published_at) - new Date(a.published_at);
}

function renderResourceRows(posts) {
    if (!posts.length) {
        listingDom.resourcesList.innerHTML = '';
        listingDom.blogEmpty.style.display = 'block';
        return;
    }

    listingDom.blogEmpty.style.display = 'none';

    if (listingDom.usesLegacyGrid) {
        renderLegacyGrid(posts);
        return;
    }

    listingDom.resourcesList.innerHTML = posts.map((post, index) => {
        const typeInfo = RESOURCE_TYPES[post.resourceMeta.contentType];

        return `
            <article class="resource-row reveal-card" style="transition-delay: ${Math.min(index, 6) * 40}ms;">
                <a class="resource-row-media" href="blog.html?post=${encodeURIComponent(post.slug)}" aria-label="${escapeHtml(post.title)}">
                    ${renderCardImage(post, 'resource-row-image')}
                </a>
                <div class="resource-row-content">
                    <div class="resource-row-meta">
                        <span class="resource-label-pill">${escapeHtml(post.resourceMeta.label)}</span>
                        <span>${escapeHtml(typeInfo.label)}</span>
                        <span>${formatDate(post.published_at)}</span>
                        ${post.reading_time_minutes ? `<span>${post.reading_time_minutes} min read</span>` : ''}
                    </div>
                    <h3 class="resource-row-title">
                        <a href="blog.html?post=${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a>
                    </h3>
                    ${post.excerpt ? `<p class="resource-row-excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
                    <div class="resource-row-footer">
                        <a class="resource-row-link" href="blog.html?post=${encodeURIComponent(post.slug)}">
                            ${escapeHtml(typeInfo.cta)}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </a>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

function renderLegacyGrid(posts) {
    listingDom.resourcesList.innerHTML = posts.map((post) => `
        <article class="blog-card reveal-card" onclick="window.location.href='blog.html?post=${post.slug}'">
            ${post.cover_image_url ? `
                <img class="blog-card-image" src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.title)}" loading="lazy">
            ` : `
                <div class="blog-card-image placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                </div>
            `}
            <div class="blog-card-content">
                <div class="blog-card-meta">
                    <span class="blog-card-date">${formatDate(post.published_at)}</span>
                    ${post.reading_time_minutes ? `<span class="blog-card-reading-time">${post.reading_time_minutes} min read</span>` : ''}
                </div>
                <h3 class="blog-card-title">${escapeHtml(post.title)}</h3>
                ${post.excerpt ? `<p class="blog-card-excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
                <span class="blog-card-link">Read more</span>
            </div>
        </article>
    `).join('');
}

function updateResultsSummary(filteredCount, totalCount) {
    if (!listingDom.resultsSummary) return;

    if (!totalCount) {
        listingDom.resultsSummary.textContent = 'No live resources yet.';
        return;
    }

    if (filteredCount === totalCount) {
        listingDom.resultsSummary.textContent = `${totalCount} live ${totalCount === 1 ? 'resource' : 'resources'}`;
        return;
    }

    listingDom.resultsSummary.textContent = `Showing ${filteredCount} of ${totalCount} resources`;
}

function updateTypePillState() {
    listingDom.typePills?.querySelectorAll('[data-type]').forEach((button) => {
        button.classList.toggle('active', button.dataset.type === state.activeType);
    });
}

function renderFeaturedCarousel(posts) {
    stopSlideTimer();
    state.activeSlide = 0;

    if (!listingDom.featuredTrack) {
        return;
    }

    if (!posts.length) {
        renderFeaturedFallback();
        return;
    }

    listingDom.featuredTrack.innerHTML = posts.map((post, index) => `
        <article class="featured-slide" data-slide="${index}">
            <div class="featured-slide-shell">
                <div class="featured-copy">
                    <div class="featured-topline">
                        <span class="featured-index">0${index + 1}</span>
                        <span class="featured-type">${escapeHtml(post.resourceMeta.typeLabel)}</span>
                    </div>
                    <p class="featured-label">${escapeHtml(post.resourceMeta.label)}</p>
                    <h3 class="featured-title">${escapeHtml(post.title)}</h3>
                    ${post.excerpt ? `<p class="featured-excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
                    <div class="featured-meta">
                        <span>${formatDate(post.published_at)}</span>
                        ${post.reading_time_minutes ? `<span>${post.reading_time_minutes} min read</span>` : ''}
                    </div>
                    <a class="featured-link" href="blog.html?post=${encodeURIComponent(post.slug)}">
                        Open resource
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </a>
                </div>
                <a class="featured-media" href="blog.html?post=${encodeURIComponent(post.slug)}" aria-label="${escapeHtml(post.title)}">
                    ${renderCardImage(post, 'featured-image')}
                </a>
            </div>
        </article>
    `).join('');

    if (listingDom.featuredDots) {
        listingDom.featuredDots.innerHTML = posts.map((_, index) => `
            <button class="featured-dot${index === 0 ? ' active' : ''}" type="button" data-slide-dot="${index}" aria-label="Go to featured slide ${index + 1}"></button>
        `).join('');
    }

    listingDom.featuredDots?.querySelectorAll('[data-slide-dot]').forEach((button) => {
        button.addEventListener('click', () => goToSlide(Number(button.dataset.slideDot)));
    });

    goToSlide(0);
    startSlideTimer();
}

function renderFeaturedFallback() {
    stopSlideTimer();
    if (!listingDom.featuredTrack) return;

    listingDom.featuredTrack.innerHTML = `
        <article class="featured-slide featured-slide-empty">
            <div class="featured-slide-shell">
                <div class="featured-copy">
                    <div class="featured-topline">
                        <span class="featured-index">00</span>
                        <span class="featured-type">Awaiting first publish</span>
                    </div>
                    <p class="featured-label">Editor’s pick</p>
                    <h3 class="featured-title">Your featured resources will appear here.</h3>
                    <p class="featured-excerpt">Use the admin portal to publish articles, then mark up to five of them for the featured carousel.</p>
                    <a class="featured-link" href="admin.html">Open admin portal</a>
                </div>
                <div class="featured-media featured-media-placeholder">
                    <div class="featured-placeholder-grid"></div>
                </div>
            </div>
        </article>
    `;

    listingDom.featuredDots.innerHTML = '';
}

function goToSlide(index) {
    if (!state.featuredPosts.length || !listingDom.featuredTrack) return;

    const totalSlides = state.featuredPosts.length;
    state.activeSlide = (index + totalSlides) % totalSlides;

    listingDom.featuredTrack.style.transform = `translateX(-${state.activeSlide * 100}%)`;

    listingDom.featuredDots?.querySelectorAll('[data-slide-dot]').forEach((button, buttonIndex) => {
        button.classList.toggle('active', buttonIndex === state.activeSlide);
    });
}

function startSlideTimer() {
    stopSlideTimer();

    if (state.featuredPosts.length <= 1) return;

    state.slideTimer = window.setInterval(() => {
        goToSlide(state.activeSlide + 1);
    }, 6500);
}

function stopSlideTimer() {
    if (state.slideTimer) {
        clearInterval(state.slideTimer);
        state.slideTimer = null;
    }
}

function renderCardImage(post, className) {
    if (post.cover_image_url) {
        return `<img class="${className}" src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.title)}" loading="lazy">`;
    }

    return `
        <div class="${className} ${className}-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
        </div>
    `;
}

async function loadSinglePost(slug) {
    listingDom.blogListing.style.display = 'none';
    listingDom.blogSingle.style.display = 'block';

    try {
        const { data: post, error } = await blogSupabase
            .from('posts')
            .select('*')
            .eq('slug', slug)
            .eq('status', 'published')
            .single();

        if (error || !post) {
            window.location.href = 'blog.html';
            return;
        }

        renderSinglePost(normalizePost(post));
        updateMetaTags(post);
        setupShareLinks(post);

    } catch (error) {
        console.error('Error loading post:', error);
        window.location.href = 'blog.html';
    }
}

function renderSinglePost(post) {
    const postTypePill = document.getElementById('post-type-pill');
    const postLabel = document.getElementById('post-label');
    const coverImg = document.getElementById('post-cover');
    const excerptElement = document.getElementById('post-excerpt');
    const contentContainer = document.getElementById('post-content');

    document.getElementById('post-title').textContent = post.title;
    document.getElementById('post-date').textContent = formatDate(post.published_at);
    document.getElementById('post-reading-time').textContent = `${post.reading_time_minutes || 5} min read`;

    if (postLabel) {
        postLabel.textContent = `${post.resourceMeta.label} • ${post.resourceMeta.typeLabel}`;
    }

    if (postTypePill) {
        postTypePill.textContent = post.resourceMeta.typeLabel;
        postTypePill.style.display = 'inline-flex';
    }

    if (post.excerpt) {
        excerptElement.textContent = post.excerpt;
        excerptElement.style.display = 'block';
    } else {
        excerptElement.style.display = 'none';
    }

    if (post.cover_image_url) {
        coverImg.src = post.cover_image_url;
        coverImg.alt = post.title;
        coverImg.style.display = 'block';
    } else {
        coverImg.style.display = 'none';
    }

    contentContainer.innerHTML = renderTipTapContent(post.content);
    document.title = `${post.title} — Krevia Resources`;
}

function renderTipTapContent(json) {
    if (!json || !json.content) return '';

    return json.content.map((node) => renderNode(node)).join('');
}

function renderNode(node) {
    if (!node) return '';

    switch (node.type) {
        case 'paragraph': {
            const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
            return content ? `<p>${content}</p>` : '<p><br></p>';
        }

        case 'heading': {
            const level = node.attrs?.level || 2;
            const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
            return `<h${level}>${content}</h${level}>`;
        }

        case 'text': {
            let text = escapeHtml(node.text || '');

            if (node.marks) {
                node.marks.forEach((mark) => {
                    switch (mark.type) {
                        case 'bold':
                            text = `<strong>${text}</strong>`;
                            break;
                        case 'italic':
                            text = `<em>${text}</em>`;
                            break;
                        case 'link': {
                            const href = mark.attrs?.href || '#';
                            const target = mark.attrs?.target || '_blank';
                            text = `<a href="${escapeHtml(href)}" target="${escapeHtml(target)}" rel="noopener">${text}</a>`;
                            break;
                        }
                        case 'code':
                            text = `<code>${text}</code>`;
                            break;
                    }
                });
            }

            return text;
        }

        case 'bulletList': {
            const items = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
            return `<ul>${items}</ul>`;
        }

        case 'orderedList': {
            const items = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
            return `<ol>${items}</ol>`;
        }

        case 'listItem': {
            const items = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
            return `<li>${items}</li>`;
        }

        case 'blockquote': {
            const content = node.content ? node.content.map((child) => renderNode(child)).join('') : '';
            return `<blockquote>${content}</blockquote>`;
        }

        case 'codeBlock': {
            const content = node.content ? node.content.map((child) => child.text || renderNode(child)).join('') : '';
            return `<pre><code>${escapeHtml(content)}</code></pre>`;
        }

        case 'image': {
            const src = node.attrs?.src || '';
            const alt = node.attrs?.alt || '';
            const title = node.attrs?.title || '';
            return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" title="${escapeHtml(title)}" loading="lazy">`;
        }

        case 'horizontalRule':
            return '<hr>';

        case 'hardBreak':
            return '<br>';

        default:
            if (node.content) {
                return node.content.map((child) => renderNode(child)).join('');
            }
            return '';
    }
}

function setupShareLinks(post) {
    const pageUrl = encodeURIComponent(window.location.href);
    const pageTitle = encodeURIComponent(post.title);

    document.getElementById('share-twitter').href =
        `https://twitter.com/intent/tweet?text=${pageTitle}&url=${pageUrl}`;

    document.getElementById('share-linkedin').href =
        `https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}`;

    document.getElementById('share-whatsapp').href =
        `https://wa.me/?text=${pageTitle}%20${pageUrl}`;
}

function updateMetaTags(post) {
    const metaDesc = document.querySelector('meta[name="description"]');

    if (metaDesc && post.meta_description) {
        metaDesc.setAttribute('content', post.meta_description);
    } else if (metaDesc && post.excerpt) {
        metaDesc.setAttribute('content', post.excerpt);
    }

    addMetaTag('og:title', post.title);
    addMetaTag('og:description', post.excerpt || post.meta_description || '');
    addMetaTag('og:type', 'article');
    addMetaTag('og:url', window.location.href);

    if (post.cover_image_url) {
        addMetaTag('og:image', post.cover_image_url);
    }

    addMetaTag('twitter:card', 'summary_large_image');
    addMetaTag('twitter:title', post.title);
    addMetaTag('twitter:description', post.excerpt || post.meta_description || '');

    if (post.cover_image_url) {
        addMetaTag('twitter:image', post.cover_image_url);
    }
}

function addMetaTag(property, content) {
    let meta = document.querySelector(`meta[property="${property}"]`) ||
               document.querySelector(`meta[name="${property}"]`);

    if (!meta) {
        meta = document.createElement('meta');

        if (property.startsWith('og:')) {
            meta.setAttribute('property', property);
        } else {
            meta.setAttribute('name', property);
        }

        document.head.appendChild(meta);
    }

    meta.setAttribute('content', content);
}

function formatDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
