/* ============================================
   KREVIA BLOG - Admin Dashboard & Editor
   ============================================ */

import { Editor } from 'https://esm.sh/@tiptap/core@2.1.13';
import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2.1.13';
import Image from 'https://esm.sh/@tiptap/extension-image@2.1.13';
import Link from 'https://esm.sh/@tiptap/extension-link@2.1.13';
import Placeholder from 'https://esm.sh/@tiptap/extension-placeholder@2.1.13';

const SUPABASE_URL = 'https://jmcquwcoxefbvwwglikn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptY3F1d2NveGVmYnZ3d2dsaWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjkyMDksImV4cCI6MjA5MDAwNTIwOX0.rQUOV2V0Gx31P9DmDRm0XflyY78Voaa_z9qo6leTvPw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const RESOURCE_TYPES = {
    article: {
        label: 'Article',
        defaultLabel: 'Field Note'
    },
    'customer-story': {
        label: 'Customer Story',
        defaultLabel: 'Growth Story'
    },
    press: {
        label: 'Press',
        defaultLabel: 'Press Note'
    }
};

let editor = null;
let currentUser = null;
let deletePostId = null;
let coverImageUrl = null;
let postsCache = [];

const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const navUser = document.getElementById('nav-user');
const postsTableBody = document.getElementById('posts-table-body');
const postsLoading = document.getElementById('posts-loading');
const postsEmpty = document.getElementById('posts-empty');
const editorOverlay = document.getElementById('editor-overlay');
const editorModal = document.getElementById('editor-modal');
const featuredCheckbox = document.getElementById('post-featured-input');
const featuredSlotField = document.getElementById('featured-slot-field');

document.addEventListener('DOMContentLoaded', () => {
    initAdmin();
    initTipTapEditor();
    setupToolbarEvents();
    setupTitleSlugSync();
    setupDragDrop();
    setupFeaturedControls();
});

async function initAdmin() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        currentUser = session.user;
        showDashboard();
        loadPosts();
    } else {
        showLogin();
    }

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            showDashboard();
            loadPosts();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showLogin();
        }
    });
}

function showLogin() {
    loginSection.style.display = 'flex';
    dashboardSection.style.display = 'none';
    navUser.style.display = 'none';
}

function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    navUser.style.display = 'block';
}

window.handleLogin = async function(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span>Signing in...</span>';
    loginError.classList.remove('show');

    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast('Welcome back!', 'success');
    } catch (error) {
        loginError.textContent = error.message || 'Invalid email or password';
        loginError.classList.add('show');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = `<span>Sign In</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
            </svg>`;
    }
};

window.handleLogout = async function() {
    await supabase.auth.signOut();
    showToast('Logged out successfully', 'success');
};

async function loadPosts() {
    postsLoading.style.display = 'block';
    postsTableBody.innerHTML = '';
    postsEmpty.style.display = 'none';

    try {
        const { data: posts, error } = await supabase
            .from('posts')
            .select('id, title, slug, status, created_at, updated_at, published_at, content')
            .order('updated_at', { ascending: false });

        postsLoading.style.display = 'none';

        if (error) {
            console.error('Error fetching posts:', error);
            showToast('Error loading posts', 'error');
            return;
        }

        postsCache = (posts || []).map((post) => ({
            ...post,
            resourceMeta: extractResourceMeta(post.content)
        }));

        if (!postsCache.length) {
            postsEmpty.style.display = 'block';
            return;
        }

        renderPostsTable(postsCache);

    } catch (error) {
        console.error('Error loading posts:', error);
        postsLoading.style.display = 'none';
        showToast('Error loading posts', 'error');
    }
}

function renderPostsTable(posts) {
    postsTableBody.innerHTML = posts.map((post) => `
        <tr>
            <td>
                <span class="admin-post-title">${escapeHtml(post.title)}</span>
            </td>
            <td>${escapeHtml(post.resourceMeta.typeLabel)}</td>
            <td>${post.resourceMeta.featured ? `Slot ${post.resourceMeta.featuredSlot}` : '—'}</td>
            <td>
                <span class="admin-post-status ${post.status}">${post.status}</span>
            </td>
            <td>${formatDate(post.status === 'published' ? post.published_at : post.updated_at)}</td>
            <td>
                <div class="admin-post-actions">
                    <button class="admin-btn-icon" onclick="editPost('${post.id}')" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="admin-btn-icon" onclick="viewPost('${post.slug}')" title="View">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <button class="admin-btn-icon delete" onclick="deletePost('${post.id}')" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.viewPost = function(slug) {
    window.open(`blog.html?post=${slug}`, '_blank');
};

function initTipTapEditor() {
    editor = new Editor({
        element: document.getElementById('editor'),
        extensions: [
            StarterKit,
            Image.configure({
                inline: false,
                allowBase64: false
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    target: '_blank',
                    rel: 'noopener noreferrer'
                }
            }),
            Placeholder.configure({
                placeholder: 'Start writing your content...'
            })
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'tiptap-editor'
            }
        },
        onUpdate: () => updateToolbarState(),
        onSelectionUpdate: () => updateToolbarState()
    });
}

function setupToolbarEvents() {
    document.querySelectorAll('.tiptap-btn[data-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            executeEditorAction(button.dataset.action);
        });
    });
}

function executeEditorAction(action) {
    if (!editor) return;

    switch (action) {
        case 'bold':
            editor.chain().focus().toggleBold().run();
            break;
        case 'italic':
            editor.chain().focus().toggleItalic().run();
            break;
        case 'h1':
            editor.chain().focus().toggleHeading({ level: 1 }).run();
            break;
        case 'h2':
            editor.chain().focus().toggleHeading({ level: 2 }).run();
            break;
        case 'h3':
            editor.chain().focus().toggleHeading({ level: 3 }).run();
            break;
        case 'bulletList':
            editor.chain().focus().toggleBulletList().run();
            break;
        case 'orderedList':
            editor.chain().focus().toggleOrderedList().run();
            break;
        case 'blockquote':
            editor.chain().focus().toggleBlockquote().run();
            break;
        case 'link':
            openLinkModal();
            break;
        case 'image':
            document.getElementById('image-upload-input').click();
            break;
    }

    updateToolbarState();
}

function updateToolbarState() {
    if (!editor) return;

    document.querySelectorAll('.tiptap-btn[data-action]').forEach((button) => {
        const action = button.dataset.action;
        let isActive = false;

        switch (action) {
            case 'bold':
                isActive = editor.isActive('bold');
                break;
            case 'italic':
                isActive = editor.isActive('italic');
                break;
            case 'h1':
                isActive = editor.isActive('heading', { level: 1 });
                break;
            case 'h2':
                isActive = editor.isActive('heading', { level: 2 });
                break;
            case 'h3':
                isActive = editor.isActive('heading', { level: 3 });
                break;
            case 'bulletList':
                isActive = editor.isActive('bulletList');
                break;
            case 'orderedList':
                isActive = editor.isActive('orderedList');
                break;
            case 'blockquote':
                isActive = editor.isActive('blockquote');
                break;
            case 'link':
                isActive = editor.isActive('link');
                break;
        }

        button.classList.toggle('active', isActive);
    });
}

function openLinkModal() {
    const linkModal = document.getElementById('link-modal');
    const linkInput = document.getElementById('link-url-input');
    const previousUrl = editor.getAttributes('link').href;

    linkInput.value = previousUrl || '';
    linkModal.classList.add('show');
    linkInput.focus();
}

window.closeLinkModal = function() {
    document.getElementById('link-modal').classList.remove('show');
};

window.insertLink = function() {
    const url = document.getElementById('link-url-input').value.trim();

    if (url) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }

    closeLinkModal();
};

window.handleImageUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be less than 5MB', 'error');
        return;
    }

    showToast('Uploading image...', 'success');

    try {
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
        const { error } = await supabase.storage
            .from('blog-images')
            .upload(fileName, file);

        if (error) throw error;

        const { data: urlData } = supabase.storage
            .from('blog-images')
            .getPublicUrl(fileName);

        editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
        showToast('Image uploaded!', 'success');

    } catch (error) {
        console.error('Upload error:', error);
        showToast('Failed to upload image', 'error');
    }

    event.target.value = '';
};

window.handleCoverUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be less than 5MB', 'error');
        return;
    }

    showToast('Uploading cover...', 'success');

    try {
        const fileName = `covers/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
        const { error } = await supabase.storage
            .from('blog-images')
            .upload(fileName, file);

        if (error) throw error;

        const { data: urlData } = supabase.storage
            .from('blog-images')
            .getPublicUrl(fileName);

        coverImageUrl = urlData.publicUrl;
        updateCoverPreview();
        showToast('Cover uploaded!', 'success');

    } catch (error) {
        console.error('Upload error:', error);
        showToast('Failed to upload cover', 'error');
    }
};

function updateCoverPreview() {
    const preview = document.getElementById('cover-preview');
    const placeholder = document.getElementById('cover-placeholder');
    const removeBtn = document.getElementById('cover-remove');
    const uploadDiv = document.getElementById('cover-upload');

    if (coverImageUrl) {
        preview.src = coverImageUrl;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        removeBtn.style.display = 'flex';
        uploadDiv.classList.add('has-image');
    } else {
        preview.style.display = 'none';
        placeholder.style.display = 'block';
        removeBtn.style.display = 'none';
        uploadDiv.classList.remove('has-image');
    }
}

window.removeCover = function(event) {
    event.stopPropagation();
    coverImageUrl = null;
    document.getElementById('cover-input').value = '';
    updateCoverPreview();
};

function setupDragDrop() {
    const coverUpload = document.getElementById('cover-upload');

    coverUpload.addEventListener('dragover', (event) => {
        event.preventDefault();
        coverUpload.style.borderColor = 'var(--accent)';
        coverUpload.style.background = 'var(--grey-50)';
    });

    coverUpload.addEventListener('dragleave', () => {
        coverUpload.style.borderColor = '';
        coverUpload.style.background = '';
    });

    coverUpload.addEventListener('drop', (event) => {
        event.preventDefault();
        coverUpload.style.borderColor = '';
        coverUpload.style.background = '';

        const file = event.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const input = document.getElementById('cover-input');
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            handleCoverUpload({ target: input });
        }
    });
}

function setupFeaturedControls() {
    featuredCheckbox?.addEventListener('change', syncFeaturedControls);
    syncFeaturedControls();
}

function syncFeaturedControls() {
    if (!featuredCheckbox || !featuredSlotField) return;
    featuredSlotField.classList.toggle('is-visible', featuredCheckbox.checked);
}

window.openEditor = function(postId = null) {
    document.getElementById('editing-post-id').value = postId || '';
    document.getElementById('editor-title').textContent = postId ? 'Edit Resource' : 'New Resource';
    document.getElementById('publish-btn-text').textContent = postId ? 'Update' : 'Publish';

    document.getElementById('post-title-input').value = '';
    document.getElementById('post-slug-input').value = '';
    document.getElementById('post-slug-input').removeAttribute('data-manual');
    document.getElementById('post-excerpt-input').value = '';
    document.getElementById('post-meta-input').value = '';
    document.getElementById('post-type-input').value = 'article';
    document.getElementById('post-label-input').value = '';
    document.getElementById('post-featured-input').checked = false;
    document.getElementById('post-featured-slot-input').value = '1';
    coverImageUrl = null;
    updateCoverPreview();
    syncFeaturedControls();
    editor.commands.setContent('');

    editorOverlay.classList.add('show');
    editorModal.classList.add('show');
    document.body.style.overflow = 'hidden';
};

window.closeEditor = function() {
    editorOverlay.classList.remove('show');
    editorModal.classList.remove('show');
    document.body.style.overflow = '';
};

window.editPost = async function(postId) {
    openEditor(postId);

    try {
        const { data: post, error } = await supabase
            .from('posts')
            .select('*')
            .eq('id', postId)
            .single();

        if (error) throw error;

        const meta = extractResourceMeta(post.content);

        document.getElementById('post-title-input').value = post.title || '';
        document.getElementById('post-slug-input').value = post.slug || '';
        document.getElementById('post-slug-input').setAttribute('data-manual', 'true');
        document.getElementById('post-excerpt-input').value = post.excerpt || '';
        document.getElementById('post-meta-input').value = post.meta_description || '';
        document.getElementById('post-type-input').value = meta.contentType;
        document.getElementById('post-label-input').value = meta.customLabel;
        document.getElementById('post-featured-input').checked = meta.featured;
        document.getElementById('post-featured-slot-input').value = String(meta.featuredSlot || 1);
        coverImageUrl = post.cover_image_url;
        updateCoverPreview();
        syncFeaturedControls();
        editor.commands.setContent(stripResourceMeta(post.content) || '');

    } catch (error) {
        console.error('Error loading post:', error);
        showToast('Error loading post', 'error');
        closeEditor();
    }
};

window.savePost = async function(asDraft = false) {
    const title = document.getElementById('post-title-input').value.trim();
    let slug = document.getElementById('post-slug-input').value.trim();
    const excerpt = document.getElementById('post-excerpt-input').value.trim();
    const metaDescription = document.getElementById('post-meta-input').value.trim();
    const contentType = normalizeContentType(document.getElementById('post-type-input').value);
    const customLabel = document.getElementById('post-label-input').value.trim();
    const isFeatured = document.getElementById('post-featured-input').checked;
    const featuredSlot = isFeatured ? normalizeFeaturedSlot(document.getElementById('post-featured-slot-input').value) : null;
    const postId = document.getElementById('editing-post-id').value;

    if (!title) {
        showToast('Title is required', 'error');
        return;
    }

    if (!slug) {
        slug = generateSlug(title);
    }

    if (isFeatured && featuredSlot === null) {
        showToast('Choose a featured slot between 1 and 5', 'error');
        return;
    }

    const conflictingPost = postsCache.find((post) =>
        post.id !== postId &&
        post.resourceMeta.featured &&
        post.resourceMeta.featuredSlot === featuredSlot
    );

    if (isFeatured && conflictingPost) {
        showToast(`Slot ${featuredSlot} is already used by "${conflictingPost.title}"`, 'error');
        return;
    }

    const editorDocument = editor.getJSON();
    const textContent = editor.getText().trim();

    if (!textContent) {
        showToast('Content is required', 'error');
        return;
    }

    const readingTime = Math.max(1, Math.ceil(textContent.split(/\s+/).filter(Boolean).length / 200));
    const resourceMeta = {
        content_type: contentType,
        resource_label: customLabel || null,
        featured_slot: featuredSlot
    };

    const postData = {
        title,
        slug,
        excerpt,
        content: attachResourceMeta(editorDocument, resourceMeta),
        cover_image_url: coverImageUrl,
        meta_description: metaDescription,
        reading_time_minutes: readingTime,
        status: asDraft ? 'draft' : 'published',
        author_email: currentUser.email
    };

    if (!asDraft && !postId) {
        postData.published_at = new Date().toISOString();
    } else if (!asDraft && postId) {
        const { data: existingPost } = await supabase
            .from('posts')
            .select('status')
            .eq('id', postId)
            .single();

        if (existingPost?.status === 'draft') {
            postData.published_at = new Date().toISOString();
        }
    }

    try {
        let result;

        if (postId) {
            result = await supabase
                .from('posts')
                .update(postData)
                .eq('id', postId)
                .select();
        } else {
            result = await supabase
                .from('posts')
                .insert(postData)
                .select();
        }

        if (result.error) throw result.error;

        showToast(asDraft ? 'Draft saved!' : 'Resource published!', 'success');
        closeEditor();
        loadPosts();

    } catch (error) {
        console.error('Save error:', error);
        if (error.message?.includes('duplicate')) {
            showToast('Slug already exists. Please use a different one.', 'error');
        } else {
            showToast('Error saving resource', 'error');
        }
    }
};

window.deletePost = function(postId) {
    deletePostId = postId;
    document.getElementById('confirm-overlay').classList.add('show');
};

window.closeConfirmDialog = function() {
    document.getElementById('confirm-overlay').classList.remove('show');
    deletePostId = null;
};

window.confirmDelete = async function() {
    if (!deletePostId) return;

    try {
        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', deletePostId);

        if (error) throw error;

        showToast('Post deleted', 'success');
        closeConfirmDialog();
        loadPosts();

    } catch (error) {
        console.error('Delete error:', error);
        showToast('Error deleting post', 'error');
    }
};

window.seedStarterResources = async function() {
    if (!currentUser) {
        showToast('Sign in first to seed starter resources', 'error');
        return;
    }

    const starterBlueprints = getStarterResourceBlueprints();
    const starterSlugs = starterBlueprints.map((resource) => resource.slug);

    try {
        const { data: existing, error: existingError } = await supabase
            .from('posts')
            .select('slug')
            .in('slug', starterSlugs);

        if (existingError) throw existingError;

        const existingSlugs = new Set((existing || []).map((item) => item.slug));
        const insertPayload = starterBlueprints
            .filter((resource) => !existingSlugs.has(resource.slug))
            .map((resource, index) => {
                const publishedAt = new Date(Date.now() - index * 86400000).toISOString();
                const content = createStarterDocument({
                    contentType: resource.contentType,
                    resourceLabel: resource.resourceLabel,
                    featuredSlot: resource.featuredSlot
                }, resource.blocks);

                return {
                    title: resource.title,
                    slug: resource.slug,
                    excerpt: resource.excerpt,
                    content,
                    cover_image_url: resource.coverImageUrl,
                    meta_description: resource.metaDescription,
                    reading_time_minutes: estimateReadingTimeFromDocument(content),
                    status: 'published',
                    author_email: currentUser.email,
                    published_at: publishedAt
                };
            });

        if (!insertPayload.length) {
            showToast('Starter resources already exist', 'success');
            return;
        }

        const { error } = await supabase
            .from('posts')
            .insert(insertPayload);

        if (error) throw error;

        showToast('Starter resources added', 'success');
        loadPosts();

    } catch (error) {
        console.error('Seed error:', error);
        showToast('Could not seed starter resources', 'error');
    }
};

function setupTitleSlugSync() {
    const titleInput = document.getElementById('post-title-input');
    const slugInput = document.getElementById('post-slug-input');

    titleInput.addEventListener('input', () => {
        if (!slugInput.dataset.manual) {
            slugInput.value = generateSlug(titleInput.value);
        }
    });

    slugInput.addEventListener('input', () => {
        slugInput.dataset.manual = 'true';
    });
}

function generateSlug(title) {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 60);
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

function extractResourceMeta(content) {
    const meta = content && typeof content === 'object' ? content.krevia_meta || {} : {};
    const contentType = normalizeContentType(meta.content_type);
    const featuredSlot = normalizeFeaturedSlot(meta.featured_slot);
    const customLabel = typeof meta.resource_label === 'string' ? meta.resource_label.trim() : '';

    return {
        contentType,
        typeLabel: RESOURCE_TYPES[contentType].label,
        featuredSlot,
        featured: featuredSlot !== null,
        customLabel
    };
}

function attachResourceMeta(content, meta) {
    const documentContent = content && typeof content === 'object'
        ? JSON.parse(JSON.stringify(content))
        : { type: 'doc', content: [] };

    documentContent.krevia_meta = {
        content_type: normalizeContentType(meta.content_type),
        resource_label: meta.resource_label || null,
        featured_slot: normalizeFeaturedSlot(meta.featured_slot)
    };

    return documentContent;
}

function stripResourceMeta(content) {
    if (!content || typeof content !== 'object') return content;

    const clone = JSON.parse(JSON.stringify(content));
    delete clone.krevia_meta;
    return clone;
}

function estimateReadingTimeFromDocument(content) {
    const words = extractTextFromNode(content).split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}

function extractTextFromNode(node) {
    if (!node) return '';
    if (typeof node.text === 'string') return node.text;
    if (!Array.isArray(node.content)) return '';
    return node.content.map((child) => extractTextFromNode(child)).join(' ');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatDate(dateString) {
    if (!dateString) return '-';

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

function createTextNode(text) {
    return { type: 'text', text };
}

function createParagraph(text) {
    return {
        type: 'paragraph',
        content: [createTextNode(text)]
    };
}

function createHeading(level, text) {
    return {
        type: 'heading',
        attrs: { level },
        content: [createTextNode(text)]
    };
}

function createBulletList(items) {
    return {
        type: 'bulletList',
        content: items.map((item) => ({
            type: 'listItem',
            content: [createParagraph(item)]
        }))
    };
}

function createStarterDocument(meta, blocks) {
    return attachResourceMeta({
        type: 'doc',
        content: blocks
    }, {
        content_type: meta.contentType,
        resource_label: meta.resourceLabel,
        featured_slot: meta.featuredSlot
    });
}

function getStarterResourceBlueprints() {
    return [
        {
            title: 'Why India\'s Next Property Buyer Meets Your Project on a Phone Screen First',
            slug: 'india-property-buyers-start-on-mobile',
            excerpt: 'A practical guide to turning mobile-first discovery into more qualified site visits for Indian real estate teams.',
            metaDescription: 'How Indian real estate teams can win mobile-first buyers with faster pages, clearer trust signals, and better speed-to-lead workflows.',
            contentType: 'article',
            resourceLabel: 'Mobile Buyer Journey',
            featuredSlot: 1,
            coverImageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
            blocks: [
                createParagraph('For most real estate teams in India, the first meeting with a buyer does not happen at the site office anymore. It happens on a phone screen, inside a WhatsApp thread, or through a landing page someone opens between meetings.'),
                createHeading(2, 'Attention is mobile. Trust still has to be earned.'),
                createParagraph('The challenge is not just getting attention. The challenge is converting early curiosity into enough confidence for a call, a brochure request, or a visit. That means your digital experience has to move faster than your ad spend.'),
                createBulletList([
                    'Landing pages should load quickly on mid-range devices and weaker mobile data connections.',
                    'Project details need to be scannable in seconds, not buried in heavy page sections.',
                    'WhatsApp, callback, and map actions should feel immediate and frictionless.'
                ]),
                createHeading(2, 'The teams that win shorten the path from click to conversation.'),
                createParagraph('A buyer exploring new launches in NCR, Bengaluru, Pune, or Hyderabad often compares multiple projects in one sitting. If your experience feels slow, generic, or confusing, the buyer does not complain. They just move on to the next tab.'),
                createParagraph('That is why the best-performing launch stacks keep the path simple: a sharp mobile microsite, one clear narrative, trust signals that feel real, and fast lead routing to the sales team that can actually respond.'),
                createHeading(2, 'What Krevia sees working right now'),
                createBulletList([
                    'Project-specific landing pages instead of one overloaded brand website experience.',
                    'Immediate WhatsApp routing for high-intent prospects.',
                    'Short proof blocks with location, possession timeline, and credibility markers.',
                    'Faster lead response systems so paid traffic does not decay before first contact.'
                ]),
                createParagraph('The mobile experience is no longer a support layer for real estate marketing in India. It is the main stage. Teams that design for that reality create more qualified conversations without always needing to spend more to get them.')
            ]
        },
        {
            title: 'From Hoardings to High Intent: A Smarter Digital Launch Stack for Indian Real Estate',
            slug: 'smarter-digital-launch-stack-indian-real-estate',
            excerpt: 'How modern project launches can connect outdoor visibility, search demand, lead capture, and follow-up into one sharper system.',
            metaDescription: 'A practical launch stack for Indian real estate teams: align campaigns, landing pages, search, WhatsApp, and site-visit workflows for higher intent leads.',
            contentType: 'article',
            resourceLabel: 'Launch Systems',
            featuredSlot: 2,
            coverImageUrl: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1600&q=80',
            blocks: [
                createParagraph('A lot of project launches still run as disconnected channels. Outdoor creates awareness. Digital creates leads. Sales handles follow-up. But when those pieces are not designed as one system, the buyer journey leaks intent at every handoff.'),
                createHeading(2, 'The modern launch stack is not about more channels.'),
                createParagraph('It is about continuity. Every campaign touchpoint should point toward the same message, the same next step, and the same conversion path. That is how recall turns into action.'),
                createBulletList([
                    'Awareness media should point to one focused project destination, not a generic homepage.',
                    'Search and social ads should match the promise of the landing experience.',
                    'Lead forms should collect only what the team actually uses to qualify interest.',
                    'Sales follow-up should happen inside a visible time window, not whenever capacity appears.'
                ]),
                createHeading(2, 'Where intent gets lost'),
                createParagraph('Real estate buyers in India move quickly between comparison, validation, and outreach. When the microsite is weak, the brochure is late, or the callback is slow, the lead may still exist in the CRM but the intent is already gone.'),
                createHeading(2, 'What a stronger stack looks like'),
                createParagraph('The strongest launch setups feel coordinated. They combine a high-trust project page, sharp visual identity, quick lead capture, and a follow-up motion that respects how fast the buyer is making decisions.'),
                createBulletList([
                    'One narrative that explains the project in a few seconds.',
                    'A design language that feels premium and specific to the launch.',
                    'A lead journey connected to WhatsApp, calls, and booking conversations.',
                    'A resource layer that keeps nurturing serious prospects after the first click.'
                ]),
                createParagraph('That is the opportunity for Indian real estate teams right now. The market is crowded, but the digital buyer experience is still weak in too many launches. The teams that tighten the system create stronger demand quality, not just bigger lead volumes.')
            ]
        },
        {
            title: '5 Ways Property Dealers Are Losing Leads Online (And How to Fix It)',
            slug: '5-ways-property-dealers-losing-leads-online',
            excerpt: 'Most property dealers lose 70% of potential buyers before they even make contact. Here are the 5 biggest digital mistakes costing you leads every day.',
            metaDescription: 'Discover the 5 common digital marketing mistakes property dealers make that cost them leads. Learn actionable fixes to capture more buyers online.',
            contentType: 'article',
            resourceLabel: 'Lead Generation',
            featuredSlot: 3,
            coverImageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80',
            blocks: [
                createParagraph('Every day, potential property buyers are searching online for their next home or investment. They type queries like "2 BHK flat in Noida" or "best builder in Gurugram" into Google. But here is the harsh truth: if you are not showing up in those searches, your competitors are getting those leads instead.'),
                createParagraph('After working with dozens of property dealers and channel partners across NCR, we have identified the 5 most common mistakes that cost real estate professionals leads every single day.'),
                createHeading(2, '1. No Website or an Outdated One'),
                createParagraph('In 2026, not having a professional website is like not having a business card in the 1990s. Buyers research online before they call. If they cannot find you, they will find someone else.'),
                createParagraph('Even worse is having a website that looks like it was built in 2010. Slow loading times, no mobile optimization, and broken contact forms send buyers running to your competition.'),
                createParagraph('The fix: Get a modern, mobile-first website with fast loading times, clear property listings, and easy contact options. Your website should load in under 3 seconds and look professional on phones.'),
                createHeading(2, '2. Ignoring Google My Business'),
                createParagraph('When someone searches "property dealer near me" or "real estate agent in Sector 62," Google shows local business listings first. If you have not claimed and optimized your Google My Business profile, you are invisible to these high-intent buyers.'),
                createParagraph('The fix: Claim your Google My Business listing today. Add photos of your office, your team, and properties you have sold. Respond to reviews. Post updates weekly. This free tool can generate more leads than paid ads if used correctly.'),
                createHeading(2, '3. Running Ads Without a Landing Page'),
                createParagraph('We see this constantly: dealers spend lakhs on Facebook and Google ads, but send all that traffic to their homepage or worse, directly to WhatsApp. The result? Wasted ad spend and confused buyers who never convert.'),
                createParagraph('The fix: Create dedicated landing pages for each project or campaign. A landing page focused on "3 BHK flats in Noida Extension" will convert 3-5x better than a generic homepage. Include project details, pricing, amenities, and a simple lead form.'),
                createHeading(2, '4. No Follow-Up System'),
                createParagraph('Getting a lead is only half the battle. Studies show that 78% of buyers go with the agent who responds first. Yet most dealers take hours or even days to follow up on inquiries.'),
                createParagraph('The fix: Set up automated responses for new inquiries. Use a CRM to track leads and set follow-up reminders. Aim to respond to every inquiry within 5 minutes during business hours. Speed wins deals.'),
                createHeading(2, '5. Inconsistent Social Media Presence'),
                createParagraph('Posting one property listing every two weeks is not a social media strategy. Buyers check your Instagram and Facebook to see if you are active, trustworthy, and knowledgeable. An abandoned social profile signals an unreliable business.'),
                createParagraph('The fix: Post consistently, at least 3-4 times per week. Mix property listings with market insights, client testimonials, and behind-the-scenes content. Show buyers that you are active and engaged in the market.'),
                createHeading(2, 'The Bottom Line'),
                createParagraph('These five mistakes are costing property dealers thousands of potential leads every month. The good news? They are all fixable. Start with one improvement this week. Claim your Google My Business. Speed up your follow-up time. Post more consistently.'),
                createParagraph('Digital presence is not optional anymore. The dealers who invest in it now will dominate their markets for years to come. The question is: will you be one of them?')
            ]
        },
        {
            title: 'Why Buyers Can\'t Find Your Properties Online (The Visibility Problem)',
            slug: 'why-buyers-cant-find-your-properties-online',
            excerpt: '92% of home buyers start their search online. If your properties are not showing up, you are invisible to the modern buyer. Here is how to fix your digital visibility.',
            metaDescription: 'Learn why your properties are not appearing in online searches and the proven strategies to increase your digital visibility as a property dealer in India.',
            contentType: 'article',
            resourceLabel: 'Digital Presence',
            featuredSlot: 4,
            coverImageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80',
            blocks: [
                createParagraph('Picture this: A young IT professional in Bangalore is ready to buy their first home. They open Google and search "ready to move flats near Electronic City." Hundreds of results appear. Builders, aggregators, portals like MagicBricks and 99acres dominate the first page.'),
                createParagraph('Where are you in this search? If you are like most property dealers we meet, the answer is: nowhere.'),
                createHeading(2, 'The Visibility Crisis in Indian Real Estate'),
                createParagraph('The real estate industry has fundamentally changed. Ten years ago, property dealing was about who you knew, newspaper ads, and hoardings. Today, it is about who can be found.'),
                createBulletList([
                    '92% of home buyers start their property search online.',
                    'The average buyer visits only 3-4 properties in person before deciding.',
                    '75% of buyers never scroll past the first page of Google results.'
                ]),
                createParagraph('If you are not visible online, you simply do not exist for the modern buyer.'),
                createHeading(2, 'Why Traditional Marketing No Longer Works'),
                createParagraph('Newspaper ads, pamphlets, and hoardings served their purpose for decades. But buyer behavior has changed dramatically.'),
                createParagraph('Before: Buyer sees hoarding, calls the number, and visits the site.'),
                createParagraph('Now: Buyer searches online, reads reviews, checks social media, compares options, shortlists 3-4, and only then calls.'),
                createParagraph('If you are only investing in offline marketing, you are entering the race at the finish line while your competitors have been running from the start.'),
                createHeading(2, 'The Three Pillars of Digital Visibility'),
                createHeading(3, '1. Search Presence'),
                createParagraph('When buyers search for properties in your area, do you appear? This includes Google search results, Google My Business listings, Google Maps, and property portals like 99acres, MagicBricks, and Housing.com.'),
                createParagraph('Action item: Search for "property dealer in your area" right now. If you are not on the first page, you have work to do.'),
                createHeading(3, '2. Social Proof'),
                createParagraph('Modern buyers trust online reviews and social media more than advertisements. They want to see Google reviews from past clients, active social media profiles, testimonials, success stories, and real photos.'),
                createParagraph('Action item: Ask your last 5 satisfied clients to leave a Google review. Real reviews from real people build trust instantly.'),
                createHeading(3, '3. Content Authority'),
                createParagraph('Buyers trust experts. The dealers who share knowledge freely attract more clients than those who only post "available for sale" listings.'),
                createBulletList([
                    'Market insights and trends.',
                    'Area guides and comparisons.',
                    'Buying tips and checklists.',
                    'Project reviews and analysis.'
                ]),
                createParagraph('Action item: Create one helpful piece of content this week. It could be a video about the top 5 things to check before buying a flat or a post about price trends in your area.'),
                createHeading(2, 'The Compound Effect of Digital Presence'),
                createParagraph('Here is what most dealers miss: digital visibility compounds over time.'),
                createBulletList([
                    'Month 1: You create a website and claim Google My Business.',
                    'Month 3: You start appearing in local searches.',
                    'Month 6: Past clients leave reviews, boosting your ranking.',
                    'Month 12: You become the go-to dealer in your area for online searches.'
                ]),
                createParagraph('The dealers who started building their digital presence 2-3 years ago are now reaping the rewards. They get inbound leads daily while others are still cold calling.'),
                createHeading(2, 'Start Today, Not Tomorrow'),
                createParagraph('Every day you wait is a day your competitors get stronger online. The good news? It is never too late to start.'),
                createBulletList([
                    'Claim your Google My Business. It takes 15 minutes and it is free.',
                    'Create or update your website. Even a simple one-page site is better than nothing.',
                    'Post on social media consistently. Start with 3 posts per week.'
                ]),
                createParagraph('The property dealers who thrive in the next decade will be those who master digital visibility today. The question is not whether you can afford to invest in digital presence. The question is whether you can afford not to.')
            ]
        }
    ];
}
